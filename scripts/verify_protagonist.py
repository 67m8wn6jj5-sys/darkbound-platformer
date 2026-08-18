from collections import Counter
from pathlib import Path
import hashlib
import json
import struct
import sys

SOURCE_ROOT = Path('.protagonist-production')
OUT = Path('assets/v05/pixellab_protagonist')
MANIFEST_PATH = OUT / 'manifest.json'
DIRECTIONS = ('east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east')
EXPECTED_COUNTS = {
    'idle': (8, 8),
    'run': (9, 9),
    'jump': (9, 9),
    'fall': (9, 9),
    'land': (9, 0),
    'attack_1': (8, 8),
    'attack_2': (8, 8),
    'attack_3': (8, 8),
    'dash': (9, 9),
    'hit': (8, 8),
    'death': (8, 8),
}
EXPECTED_FORMATS = Counter({
    (256, 256, 8, 6): 193,
    (256, 168, 8, 6): 32,
    (228, 228, 8, 6): 16,
    (168, 168, 8, 6): 8,
})


def fail(message):
    print(f'PROTAGONIST VERIFY FAILED: {message}', file=sys.stderr)
    raise SystemExit(1)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_header(path):
    data = path.read_bytes()[:26]
    if len(data) < 26 or data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        fail(f'{path} is not a valid PNG')
    width, height = struct.unpack('>II', data[16:24])
    return width, height, data[24], data[25]


def verify_grounding(meta, action, direction, expected_count):
    source_direction = direction
    if direction == 'west' and meta.get('mirrorWest'):
        source_direction = meta.get('mirrorSourceDirection', 'east')
    if direction == 'east' and meta.get('mirrorEast'):
        source_direction = meta.get('mirrorSourceDirection', 'west')
    source_count = meta.get(source_direction, 0)
    padding = (meta.get('frameBottomPadding') or {}).get(source_direction) or []
    canvas = (meta.get('frameCanvas') or {}).get(source_direction) or []
    if source_count and len(padding) != source_count:
        fail(f'{action}/{direction}: grounding padding count {len(padding)} != source frame count {source_count}')
    if source_count and len(canvas) != source_count:
        fail(f'{action}/{direction}: canvas metadata count {len(canvas)} != source frame count {source_count}')
    for index, value in enumerate(padding):
        if not isinstance(value, int) or value < 0:
            fail(f'{action}/{direction} frame {index}: invalid bottom padding {value!r}')
    for index, dims in enumerate(canvas):
        if not isinstance(dims, list) or len(dims) != 2 or min(dims) <= 0:
            fail(f'{action}/{direction} frame {index}: invalid canvas {dims!r}')


def main():
    if not MANIFEST_PATH.exists():
        fail(f'missing generated manifest: {MANIFEST_PATH}')
    if not SOURCE_ROOT.exists():
        fail('source extraction is missing; run scripts/normalize_protagonist.py first')

    manifest = json.loads(MANIFEST_PATH.read_text())
    if set(EXPECTED_COUNTS) != set(manifest):
        fail(f'manifest actions differ: expected {sorted(EXPECTED_COUNTS)}, got {sorted(manifest)}')

    for action, (east_expected, west_expected) in EXPECTED_COUNTS.items():
        meta = manifest[action]
        for direction, expected in (('east', east_expected), ('west', west_expected)):
            count = meta.get(direction)
            if count != expected:
                fail(f'{action}/{direction}: expected {expected} source frames, got {count}')
            paths = sorted((OUT / action / direction).glob('frame_*.png'))
            if len(paths) != expected:
                fail(f'{action}/{direction}: manifest/files disagree ({count} vs {len(paths)})')
            verify_grounding(meta, action, direction, expected)
        if meta.get('mappedToGameplay') is not True:
            fail(f'{action}: required action is not mapped to gameplay')
        rotations = tuple(meta.get('rotations') or ())
        if rotations != DIRECTIONS:
            fail(f'{action}: rotation list is incomplete or out of order: {rotations}')
        rotation_padding = meta.get('rotationBottomPadding') or {}
        rotation_canvas = meta.get('rotationCanvas') or {}
        if set(rotation_padding) != set(DIRECTIONS) or set(rotation_canvas) != set(DIRECTIONS):
            fail(f'{action}: incomplete rotation grounding metadata')
        if any((not isinstance(v, int) or v < 0) for v in rotation_padding.values()):
            fail(f'{action}: invalid rotation bottom padding')

    # The new landing export is the only directional animation omission: it has
    # nine east frames, no west frames, but still supplies all eight rotations.
    land = manifest['land']
    if not land.get('mirrorWest') or land.get('mirrorSourceDirection') != 'east':
        fail('landing west must explicitly mirror the supplied east-only sequence')
    for action, meta in manifest.items():
        if action != 'land' and (meta.get('mirrorEast') or meta.get('mirrorWest')):
            fail(f'{action}: unexpected animation mirroring; dedicated directional frames exist')

    attack_sources = {manifest[a].get('rotationSource') for a in ('attack_1', 'attack_2', 'attack_3')}
    if attack_sources != {'sword_attack'}:
        fail(f'three sword attacks must share the supplied Sword attack rotation set, got {attack_sources}')

    unique_rotation_sources = {meta.get('rotationSource') or action for action, meta in manifest.items()}
    if len(unique_rotation_sources) != 9:
        fail(f'expected 9 unique supplied rotation sets, got {sorted(unique_rotation_sources)}')
    for source in unique_rotation_sources:
        rotation_dir = OUT / source / 'rotations'
        paths = sorted(rotation_dir.glob('*.png'))
        if {p.stem for p in paths} != set(DIRECTIONS):
            fail(f'{source}: expected all eight rotation PNGs')

    source_pngs = sorted(p for p in SOURCE_ROOT.rglob('*.png') if '__MACOSX' not in p.parts)
    output_pngs = sorted(OUT.rglob('*.png'))
    if len(source_pngs) != 249:
        fail(f'expected 249 latest source PNGs, found {len(source_pngs)}')
    if len(output_pngs) != 249:
        fail(f'expected 249 normalized PNGs, found {len(output_pngs)}')

    # No source art may be altered, omitted, or duplicated during normalization.
    if Counter(map(digest, source_pngs)) != Counter(map(digest, output_pngs)):
        fail('normalized PNG bytes do not exactly match the latest uploaded archive')

    formats = Counter(png_header(path) for path in output_pngs)
    if formats != EXPECTED_FORMATS:
        fail(f'unexpected output PNG dimensions/format: {formats}')

    print('Latest protagonist verification passed.')
    print(f'Actions: {json.dumps(EXPECTED_COUNTS, sort_keys=True)}')
    print('Sword combo: 3 distinct supplied attack sequences mapped to combo steps 1/2/3')
    print('Landing: east-only sequence documented and mirrored only for west gameplay')
    print('Grounding: per-frame and per-rotation bottom-padding metadata present')
    print('Rotation art: 9 sets x 8 directions = 72 supplied rotation PNGs')
    print('Artwork integrity: 249/249 normalized PNGs are byte-identical to source')


if __name__ == '__main__':
    main()
