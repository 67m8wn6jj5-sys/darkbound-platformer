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
    'idle': 8,
    'run': 8,
    'jump': 8,
    'fall': 4,
    'land': 5,
    'light_attack': 9,
    'heavy_attack': 9,
    'dash': 9,
    'hit': 6,
    'death': 13,
}


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


def main():
    if not MANIFEST_PATH.exists():
        fail(f'missing generated manifest: {MANIFEST_PATH}')
    if not SOURCE_ROOT.exists():
        fail('source extraction is missing; run scripts/normalize_protagonist.py first')

    manifest = json.loads(MANIFEST_PATH.read_text())
    if set(EXPECTED_COUNTS) != set(manifest):
        fail(f'manifest actions differ: expected {sorted(EXPECTED_COUNTS)}, got {sorted(manifest)}')

    for action, expected in EXPECTED_COUNTS.items():
        meta = manifest[action]
        for direction in ('east', 'west'):
            count = meta.get(direction)
            if count != expected:
                fail(f'{action}/{direction}: expected {expected} frames, got {count}')
            paths = sorted((OUT / action / direction).glob('frame_*.png'))
            if len(paths) != expected:
                fail(f'{action}/{direction}: manifest/files disagree ({count} vs {len(paths)})')
        if meta.get('mappedToGameplay') is not True:
            fail(f'{action}: required action is not mapped to gameplay')
        if meta.get('mirrorEast') or meta.get('mirrorWest'):
            fail(f'{action}: dedicated directional art exists; mirroring must not be enabled')
        rotations = tuple(meta.get('rotations') or ())
        if rotations != DIRECTIONS:
            fail(f'{action}: rotation list is incomplete or out of order: {rotations}')

    if manifest['fall'].get('sourceFrameRange') != [0, 3]:
        fail(f"fall source range should be [0, 3], got {manifest['fall'].get('sourceFrameRange')}")
    if manifest['land'].get('sourceFrameRange') != [4, 8]:
        fail(f"land source range should be [4, 8], got {manifest['land'].get('sourceFrameRange')}")
    if manifest['land'].get('rotationSource') != 'fall':
        fail('landing must reuse the supplied Falling rotation set')

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
    if len(source_pngs) != 230:
        fail(f'expected 230 approved source PNGs, found {len(source_pngs)}')
    if len(output_pngs) != 230:
        fail(f'expected 230 normalized PNGs, found {len(output_pngs)}')

    # This is the key artwork-integrity assertion: normalization may move and
    # rename approved files, but the multiset of PNG bytes must remain exactly
    # identical. Any resize, crop, recolor, alpha change, omission, or duplicate
    # causes this check to fail.
    if Counter(map(digest, source_pngs)) != Counter(map(digest, output_pngs)):
        fail('normalized PNG bytes do not exactly match the approved source archive')

    formats = Counter(png_header(path) for path in output_pngs)
    if formats != Counter({(184, 184, 8, 6): 230}):
        fail(f'unexpected output PNG dimensions/format: {formats}')

    print('Protagonist verification passed.')
    print(f'Actions: {json.dumps(EXPECTED_COUNTS, sort_keys=True)}')
    print('Directional animation art: dedicated east + west for every action')
    print('Rotation art: 9 sets x 8 directions = 72 supplied rotation PNGs')
    print('Artwork integrity: 230/230 normalized PNGs are byte-identical to source')


if __name__ == '__main__':
    main()
