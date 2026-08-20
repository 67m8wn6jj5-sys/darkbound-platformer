from collections import Counter
from pathlib import Path
import hashlib
import json
import struct
import sys

BASE_ROOT = Path('.protagonist-production')
ATTACK_ROOT = Path('.protagonist-attack-replacements')
OUT = Path('assets/v05/pixellab_protagonist')
MANIFEST_PATH = OUT / 'manifest.json'
BASE_ARCHIVE = 'Sprite updates protagonist .zip'
ATTACK_ARCHIVE = 'Protagonist update.zip'
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
    'attack_alt': (8, 8),
    'dash': (9, 9),
    'hit': (8, 8),
    'death': (8, 8),
}
EXPECTED_ATTACK_ANIMATIONS = {
    'attack_1': 'The_character_shifts_their_weight_forward_driving',
    'attack_2': 'The_character_shifts_their_weight_forward_lifting',
    'attack_3': 'The_character_raises_their_sword_in_a_swift_powerf',
    'attack_alt': 'The_character_firmly_pivots_their_weight_onto_thei',
}
EXPECTED_OLD_ARCHIVE_ANIMATIONS = {
    'The_character_shifts_their_weight_forward_driving',
    'The_warrior_pivots_his_hips_and_drives_his_sword_i',
    'The_character_firmly_pivots_their_weight_onto_thei',
    'The_character_shifts_their_weight_forward_lifting',
}
EXPECTED_CURRENT_ARCHIVE_ANIMATIONS = {
    'The_character_shifts_their_weight_slightly_to_plan',
    'The_warrior_pivots_his_hips_and_drives_his_sword_i',
    'The_character_raises_their_sword_in_a_swift_powerf',
}
EXPECTED_FORMATS = Counter({
    (256, 256, 8, 6): 210,
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


def current_non_attack_pngs():
    kept = []
    for path in BASE_ROOT.rglob('*.png'):
        if '__MACOSX' in path.parts:
            continue
        rel = path.relative_to(BASE_ROOT)
        lowered = tuple(part.lower() for part in rel.parts)
        if len(lowered) >= 2 and lowered[0] == 'sword_attack' and lowered[1] == 'animations':
            continue
        kept.append(path)
    return sorted(kept)


def find_sword_animations(root, label):
    metadata_path = root / 'metadata.json'
    if not metadata_path.exists():
        fail(f'{label} metadata is missing')
    metadata = json.loads(metadata_path.read_text())
    for state in metadata.get('states') or []:
        character = state.get('character') or {}
        name = str(character.get('name') or state.get('folder') or '')
        if name == 'Sword attack':
            return ((state.get('frames') or {}).get('animations') or {})
    fail(f'{label} contains no Sword attack state')


def selected_old_attack_pngs():
    animations = find_sword_animations(ATTACK_ROOT, 'old attack archive')
    if set(animations) != EXPECTED_OLD_ARCHIVE_ANIMATIONS:
        fail(f'old sword animation set changed: {sorted(animations)}')
    selected = []
    for action in ('attack_1', 'attack_2', 'attack_alt'):
        animation_name = EXPECTED_ATTACK_ANIMATIONS[action]
        directional = animations[animation_name]
        for direction, expected in zip(('east', 'west'), EXPECTED_COUNTS[action]):
            relatives = directional.get(direction) or []
            if len(relatives) != expected:
                fail(f'{action}/{direction}: expected {expected} source frames, got {len(relatives)}')
            for relative in relatives:
                source = ATTACK_ROOT / relative
                if not source.exists():
                    fail(f'{action}/{direction}: missing source {relative}')
                selected.append(source)
    return selected


def selected_current_finisher_pngs():
    animations = find_sword_animations(BASE_ROOT, 'current protagonist archive')
    if set(animations) != EXPECTED_CURRENT_ARCHIVE_ANIMATIONS:
        fail(f'current sword animation set changed: {sorted(animations)}')
    action = 'attack_3'
    directional = animations[EXPECTED_ATTACK_ANIMATIONS[action]]
    selected = []
    for direction, expected in zip(('east', 'west'), EXPECTED_COUNTS[action]):
        relatives = directional.get(direction) or []
        if len(relatives) != expected:
            fail(f'{action}/{direction}: expected {expected} source frames, got {len(relatives)}')
        for relative in relatives:
            source = BASE_ROOT / relative
            if not source.exists():
                fail(f'{action}/{direction}: missing source {relative}')
            selected.append(source)
    return selected


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
        fail(f'{action}/{direction}: bottom-padding count mismatch')
    if source_count and len(canvas) != source_count:
        fail(f'{action}/{direction}: canvas metadata count mismatch')
    if any((not isinstance(value, int) or value < 0) for value in padding):
        fail(f'{action}/{direction}: invalid bottom padding')
    for dims in canvas:
        if not isinstance(dims, list) or len(dims) != 2 or min(dims) <= 0:
            fail(f'{action}/{direction}: invalid canvas metadata')


def main():
    if not MANIFEST_PATH.exists():
        fail('generated protagonist manifest is missing')
    if not BASE_ROOT.exists() or not ATTACK_ROOT.exists():
        fail('source extractions are missing; run normalize_protagonist.py first')

    manifest = json.loads(MANIFEST_PATH.read_text())
    if set(manifest) != set(EXPECTED_COUNTS):
        fail(f'manifest actions differ: {sorted(manifest)}')

    for action, counts in EXPECTED_COUNTS.items():
        meta = manifest[action]
        for direction, expected in zip(('east', 'west'), counts):
            if meta.get(direction) != expected:
                fail(f'{action}/{direction}: expected {expected}, got {meta.get(direction)}')
            paths = sorted((OUT / action / direction).glob('frame_*.png'))
            if len(paths) != expected:
                fail(f'{action}/{direction}: expected {expected} files, got {len(paths)}')
            verify_grounding(meta, action, direction)
        if meta.get('mappedToGameplay') is not True:
            fail(f'{action}: not mapped to gameplay')
        if tuple(meta.get('rotations') or ()) != DIRECTIONS:
            fail(f'{action}: incomplete rotation list')
        if set((meta.get('rotationBottomPadding') or {})) != set(DIRECTIONS):
            fail(f'{action}: incomplete rotation grounding')
        if set((meta.get('rotationCanvas') or {})) != set(DIRECTIONS):
            fail(f'{action}: incomplete rotation canvas metadata')
        if meta.get('rotationArchive') != BASE_ARCHIVE:
            fail(f'{action}: rotations are not preserved from the current archive')

        if action.startswith('attack_'):
            expected_archive = BASE_ARCHIVE if action == 'attack_3' else ATTACK_ARCHIVE
            if meta.get('sourceArchive') != expected_archive:
                fail(f'{action}: attack provenance is wrong')
            if meta.get('sourceAnimation') != EXPECTED_ATTACK_ANIMATIONS[action]:
                fail(f'{action}: wrong source animation')
        elif meta.get('sourceArchive') != BASE_ARCHIVE:
            fail(f'{action}: non-attack art is not from the current archive')

    # The disliked hip-pivot sequence exists in both source archives but must not
    # be mapped to any live/runtime attack action.
    for action in ('attack_1', 'attack_2', 'attack_3'):
        if 'pivots_his_hips' in manifest[action].get('sourceAnimation', ''):
            fail(f'{action}: disliked pivoting sword animation leaked into the live combo')
    if 'lifting' not in manifest['attack_2'].get('sourceAnimation', ''):
        fail('attack_2 is not the archived upward/lifting cut')

    land = manifest['land']
    if not land.get('mirrorWest') or land.get('mirrorSourceDirection') != 'east':
        fail('landing west must mirror the current east-only sequence')
    for action, meta in manifest.items():
        if action != 'land' and (meta.get('mirrorEast') or meta.get('mirrorWest')):
            fail(f'{action}: unexpected mirroring')

    sword_actions = ('attack_1', 'attack_2', 'attack_3', 'attack_alt')
    if {manifest[action].get('rotationSource') for action in sword_actions} != {'sword_attack'}:
        fail('all sword visuals must share the current sword rotation set')
    rotation_sources = {meta.get('rotationSource') or action for action, meta in manifest.items()}
    if len(rotation_sources) != 9:
        fail(f'expected 9 unique current rotation sets, got {sorted(rotation_sources)}')
    for source in rotation_sources:
        stems = {p.stem for p in (OUT / source / 'rotations').glob('*.png')}
        if stems != set(DIRECTIONS):
            fail(f'{source}: rotation PNG coverage is incomplete')

    current_pngs = sorted(p for p in BASE_ROOT.rglob('*.png') if '__MACOSX' not in p.parts)
    old_pngs = sorted(p for p in ATTACK_ROOT.rglob('*.png') if '__MACOSX' not in p.parts)
    output_pngs = sorted(OUT.rglob('*.png'))
    if len(current_pngs) != 249 or len(old_pngs) != 249:
        fail(f'archive identity changed: current={len(current_pngs)} old={len(old_pngs)}')
    kept_current = current_non_attack_pngs()
    selected_old = selected_old_attack_pngs()
    selected_finisher = selected_current_finisher_pngs()
    if len(kept_current) != 201:
        fail(f'expected 201 preserved current PNGs, found {len(kept_current)}')
    if len(selected_old) != 49:
        fail(f'expected 49 selected old sword PNGs, found {len(selected_old)}')
    if len(selected_finisher) != 16:
        fail(f'expected 16 current finisher PNGs, found {len(selected_finisher)}')
    if len(output_pngs) != 266:
        fail(f'expected 266 production PNGs, found {len(output_pngs)}')
    expected_composition = kept_current + selected_old + selected_finisher
    if Counter(map(digest, expected_composition)) != Counter(map(digest, output_pngs)):
        fail('production art is not the exact intended mixed-archive composition')
    if Counter(png_header(path) for path in output_pngs) != EXPECTED_FORMATS:
        fail('production PNG dimensions/formats changed unexpectedly')

    print('Fluid protagonist artwork verification passed.')
    print('Preserved: 201 current non-attack/rotation PNGs byte-for-byte')
    print('Live sword combo: old opening slash -> old upward cut -> current overhead finisher')
    print('Archived waist-height attack_alt remains non-live; pivoting attack is not selected')
    print('Production artwork: 266/266 PNGs match the intended composition')


if __name__ == '__main__':
    main()
