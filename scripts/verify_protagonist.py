from collections import Counter
from pathlib import Path
import hashlib
import json
import struct
import sys

SOURCE_ROOT = Path('.protagonist-production')
ATTACK_SOURCE_ROOT = Path('.protagonist-attack-replacements')
BASE_ARCHIVE = 'Sprite updates protagonist .zip'
ATTACK_ARCHIVE = 'Protagonist update.zip'
OUT = Path('assets/v05/pixellab_protagonist')
MANIFEST_PATH = OUT / 'manifest.json'
DIRECTIONS = ('east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east')
EXPECTED_COUNTS = {
    'idle': (8, 8),
    'run': (9, 9),
    'jump': (9, 9),
    'fall': (9, 9),
    'land': (9, 0),
    'attack_1': (9, 8),
    'attack_2': (8, 8),
    'attack_3': (8, 8),
    'dash': (9, 9),
    'hit': (8, 8),
    'death': (8, 8),
}
EXPECTED_ATTACK_ANIMATIONS = {
    'attack_1': 'The_character_shifts_their_weight_forward_driving',
    'attack_2': 'The_warrior_pivots_his_hips_and_drives_his_sword_i',
    'attack_3': 'The_character_shifts_their_weight_forward_lifting',
}
IGNORED_OLD_ATTACK = 'The_character_firmly_pivots_their_weight_onto_thei'
EXPECTED_FORMATS = Counter({
    (256, 256, 8, 6): 194,
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


def verify_grounding(meta, action, direction):
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


def current_non_attack_pngs():
    kept = []
    for path in SOURCE_ROOT.rglob('*.png'):
        if '__MACOSX' in path.parts:
            continue
        rel = path.relative_to(SOURCE_ROOT)
        lowered = tuple(part.lower() for part in rel.parts)
        if len(lowered) >= 2 and lowered[0] == 'sword_attack' and lowered[1] == 'animations':
            continue
        kept.append(path)
    return sorted(kept)


def selected_old_attack_pngs():
    metadata_path = ATTACK_SOURCE_ROOT / 'metadata.json'
    if not metadata_path.exists():
        fail(f'missing old attack metadata: {metadata_path}')
    metadata = json.loads(metadata_path.read_text())
    sword_state = None
    for state in metadata.get('states') or []:
        character = state.get('character') or {}
        name = str(character.get('name') or state.get('folder') or '')
        if name == 'Sword attack':
            sword_state = state
            break
    if not sword_state:
        fail('old attack archive contains no Sword attack state')
    animations = ((sword_state.get('frames') or {}).get('animations') or {})
    if IGNORED_OLD_ATTACK not in animations:
        fail('expected alternate old sword sequence is missing; archive identity may have changed')

    selected = []
    for action, animation_name in EXPECTED_ATTACK_ANIMATIONS.items():
        directional = animations.get(animation_name)
        if not directional:
            fail(f'{action}: old source animation missing: {animation_name}')
        for direction in ('east', 'west'):
            paths = directional.get(direction) or []
            expected = EXPECTED_COUNTS[action][0 if direction == 'east' else 1]
            if len(paths) != expected:
                fail(f'{action}/{direction}: old metadata expected {expected} paths, got {len(paths)}')
            for relative in paths:
                source = ATTACK_SOURCE_ROOT / relative
                if not source.exists():
                    fail(f'{action}/{direction}: missing old source file {relative}')
                selected.append(source)
    return selected


def main():
    if not MANIFEST_PATH.exists():
        fail(f'missing generated manifest: {MANIFEST_PATH}')
    if not SOURCE_ROOT.exists():
        fail('current source extraction is missing; run scripts/normalize_protagonist.py first')
    if not ATTACK_SOURCE_ROOT.exists():
        fail('attack replacement extraction is missing; run scripts/normalize_protagonist.py first')

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
            verify_grounding(meta, action, direction)
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
        if meta.get('rotationArchive') != BASE_ARCHIVE:
            fail(f'{action}: rotations must remain sourced from current archive')

        if action.startswith('attack_'):
            if meta.get('sourceArchive') != ATTACK_ARCHIVE:
                fail(f'{action}: expected old attack archive provenance')
            if meta.get('sourceAnimation') != EXPECTED_ATTACK_ANIMATIONS[action]:
                fail(f'{action}: wrong restored attack sequence {meta.get("sourceAnimation")!r}')
        else:
            if meta.get('sourceArchive') != BASE_ARCHIVE:
                fail(f'{action}: non-attack animation was not preserved from current archive')

    land = manifest['land']
    if not land.get('mirrorWest') or land.get('mirrorSourceDirection') != 'east':
        fail('landing west must explicitly mirror the supplied current east-only sequence')
    for action, meta in manifest.items():
        if action != 'land' and (meta.get('mirrorEast') or meta.get('mirrorWest')):
            fail(f'{action}: unexpected animation mirroring; dedicated directional frames exist')

    attack_sources = {manifest[a].get('rotationSource') for a in ('attack_1', 'attack_2', 'attack_3')}
    if attack_sources != {'sword_attack'}:
        fail(f'three sword attacks must share the current Sword attack rotation set, got {attack_sources}')

    unique_rotation_sources = {meta.get('rotationSource') or action for action, meta in manifest.items()}
    if len(unique_rotation_sources) != 9:
        fail(f'expected 9 unique current rotation sets, got {sorted(unique_rotation_sources)}')
    for source in unique_rotation_sources:
        rotation_dir = OUT / source / 'rotations'
        paths = sorted(rotation_dir.glob('*.png'))
        if {p.stem for p in paths} != set(DIRECTIONS):
            fail(f'{source}: expected all eight rotation PNGs')

    current_pngs = sorted(p for p in SOURCE_ROOT.rglob('*.png') if '__MACOSX' not in p.parts)
    old_pngs = sorted(p for p in ATTACK_SOURCE_ROOT.rglob('*.png') if '__MACOSX' not in p.parts)
    output_pngs = sorted(OUT.rglob('*.png'))
    if len(current_pngs) != 249:
        fail(f'expected 249 current source PNGs, found {len(current_pngs)}')
    if len(old_pngs) != 249:
        fail(f'expected 249 old source PNGs, found {len(old_pngs)}')

    kept_current = current_non_attack_pngs()
    selected_attacks = selected_old_attack_pngs()
    if len(kept_current) != 201:
        fail(f'expected 201 preserved current PNGs after excluding current sword animations, found {len(kept_current)}')
    if len(selected_attacks) != 49:
        fail(f'expected 49 selected old attack PNGs, found {len(selected_attacks)}')
    if len(output_pngs) != 250:
        fail(f'expected 250 normalized PNGs, found {len(output_pngs)}')

    expected_hashes = Counter(map(digest, kept_current + selected_attacks))
    output_hashes = Counter(map(digest, output_pngs))
    if expected_hashes != output_hashes:
        fail('output art is not an exact byte-for-byte composition of current non-attack art plus selected old attacks')

    formats = Counter(png_header(path) for path in output_pngs)
    if formats != EXPECTED_FORMATS:
        fail(f'unexpected output PNG dimensions/format: {formats}')

    print('Attack-only protagonist replacement verification passed.')
    print(f'Actions: {json.dumps(EXPECTED_COUNTS, sort_keys=True)}')
    print('Preserved: 201 current non-attack/rotation PNGs byte-for-byte')
    print('Restored: 49 old attack PNGs byte-for-byte across combo steps 1/2/3')
    print('Excluded: current Sword attack animation frames and one unused old alternate swing')
    print('Landing, grounding metadata, current rotations, and non-attack animations remain intact')
    print('Artwork integrity: 250/250 normalized PNGs match the intended two-archive composition')


if __name__ == '__main__':
    main()
