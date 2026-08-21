from collections import Counter
from pathlib import Path
import hashlib
import json
import struct
import sys

BASE_ROOT = Path('.protagonist-production')
TODAY_SWORD_ROOT = Path('.protagonist-attacks-today-sword')
TODAY_KO_ROOT = Path('.protagonist-attacks-today-ko')
OUT = Path('assets/v05/pixellab_protagonist')
MANIFEST_PATH = OUT / 'manifest.json'
BASE_ARCHIVE = 'Sprite updates protagonist .zip'
TODAY_SWORD_ARCHIVE = 'Recreate_this_character-Sword_attack.zip'
TODAY_KO_ARCHIVE = 'Recreate_this_character-Ko_Gasumi_sword_atta.zip'
DIRECTIONS = ('east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east')

EXPECTED_COUNTS = {
    'idle': (8, 8),
    'run': (9, 9),
    'jump': (9, 9),
    'fall': (9, 9),
    'land': (9, 0),
    'attack_1': (8, 8),
    'attack_2': (8, 8),
    'attack_3': (9, 9),
    'dash': (9, 9),
    'hit': (8, 8),
    'death': (8, 8),
}
EXPECTED_ATTACKS = {
    'attack_1': (TODAY_KO_ARCHIVE, 'Ko Gasumi sword atta', 'The_warrior_shifts_his_weight_forward_tightening_h'),
    'attack_2': (TODAY_SWORD_ARCHIVE, 'Sword attack', 'Upward_sword_slash._Starting_from_the_feet_and_fin'),
    'attack_3': (TODAY_SWORD_ARCHIVE, 'Sword attack', 'The_warrior_shifts_his_weight_forward_tightening_h'),
}
EXCLUDED_DUPLICATES = {
    'The_character_shifts_their_weight_slightly_to_plan',
    'The_character_raises_their_sword_in_a_swift_powerf',
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


def metadata(root):
    paths = sorted(root.rglob('metadata.json'), key=lambda p: (len(p.parts), len(str(p))))
    if not paths:
        fail(f'{root}: metadata missing')
    return json.loads(paths[0].read_text()), paths[0].parent


def resolve(root, meta_dir, relative):
    relative = Path(relative)
    for p in (root / relative, meta_dir / relative):
        if p.exists():
            return p
    matches = [p for p in root.rglob(relative.name) if str(p).replace('\\','/').endswith(str(relative).replace('\\','/'))]
    if len(matches) == 1:
        return matches[0]
    fail(f'{root}: cannot resolve {relative}')


def find_state(meta, name):
    for state in meta.get('states') or []:
        character = state.get('character') or {}
        current = str(character.get('name') or state.get('folder') or '')
        if current == name:
            return state
    fail(f'missing state {name!r}')


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


def source_attack_pngs(action):
    archive, state_name, anim_name = EXPECTED_ATTACKS[action]
    root = TODAY_KO_ROOT if archive == TODAY_KO_ARCHIVE else TODAY_SWORD_ROOT
    meta, meta_dir = metadata(root)
    state = find_state(meta, state_name)
    animations = ((state.get('frames') or {}).get('animations') or {})
    if anim_name not in animations:
        fail(f'{action}: source animation missing')
    directional = animations[anim_name]
    selected = []
    for direction, expected in zip(('east', 'west'), EXPECTED_COUNTS[action]):
        relatives = directional.get(direction) or []
        if len(relatives) != expected:
            fail(f'{action}/{direction}: expected {expected} source frames, got {len(relatives)}')
        selected.extend(resolve(root, meta_dir, rel) for rel in relatives)
    return selected


def verify_grounding(meta, action, direction):
    source_direction = direction
    if direction == 'west' and meta.get('mirrorWest'):
        source_direction = meta.get('mirrorSourceDirection', 'east')
    if direction == 'east' and meta.get('mirrorEast'):
        source_direction = meta.get('mirrorSourceDirection', 'west')
    count = meta.get(source_direction, 0)
    padding = (meta.get('frameBottomPadding') or {}).get(source_direction) or []
    canvas = (meta.get('frameCanvas') or {}).get(source_direction) or []
    if count and len(padding) != count:
        fail(f'{action}/{direction}: bottom-padding count mismatch')
    if count and len(canvas) != count:
        fail(f'{action}/{direction}: canvas metadata count mismatch')
    if any(not isinstance(v, int) or v < 0 for v in padding):
        fail(f'{action}/{direction}: invalid bottom padding')


def main():
    if not MANIFEST_PATH.exists():
        fail('generated protagonist manifest is missing')
    for root in (BASE_ROOT, TODAY_SWORD_ROOT, TODAY_KO_ROOT):
        if not root.exists():
            fail(f'source extraction missing: {root}')

    manifest = json.loads(MANIFEST_PATH.read_text())
    if set(manifest) != set(EXPECTED_COUNTS):
        fail(f'manifest actions differ: {sorted(manifest)}')
    if 'attack_alt' in manifest or (OUT / 'attack_alt').exists():
        fail('legacy attack_alt must not exist in the runtime production set')

    for action, counts in EXPECTED_COUNTS.items():
        meta = manifest[action]
        for direction, expected in zip(('east', 'west'), counts):
            if meta.get(direction) != expected:
                fail(f'{action}/{direction}: expected {expected}, got {meta.get(direction)}')
            files = sorted((OUT / action / direction).glob('frame_*.png'))
            if len(files) != expected:
                fail(f'{action}/{direction}: expected {expected} files, got {len(files)}')
            verify_grounding(meta, action, direction)
        if meta.get('mappedToGameplay') is not True:
            fail(f'{action}: not mapped to gameplay')
        if tuple(meta.get('rotations') or ()) != DIRECTIONS:
            fail(f'{action}: incomplete rotation list')
        if meta.get('rotationArchive') != BASE_ARCHIVE:
            fail(f'{action}: rotation provenance changed')

        if action.startswith('attack_'):
            archive, state_name, anim_name = EXPECTED_ATTACKS[action]
            if meta.get('sourceArchive') != archive:
                fail(f'{action}: sword strike is not sourced from today')
            if meta.get('sourceState') != state_name or meta.get('sourceAnimation') != anim_name:
                fail(f'{action}: wrong today-source animation mapping')
            if meta.get('sourceAnimation') in EXCLUDED_DUPLICATES:
                fail(f'{action}: duplicate older animation was selected')
        elif meta.get('sourceArchive') != BASE_ARCHIVE:
            fail(f'{action}: non-attack art provenance changed')

    if {manifest[a].get('sourceArchive') for a in ('attack_1','attack_2','attack_3')} != {TODAY_KO_ARCHIVE, TODAY_SWORD_ARCHIVE}:
        fail('live sword strikes must come only from the two 2026-08-21 packs')
    if 'Upward_sword_slash' not in manifest['attack_2'].get('sourceAnimation',''):
        fail('second strike must be the explicit upward slash')

    land = manifest['land']
    if not land.get('mirrorWest') or land.get('mirrorSourceDirection') != 'east':
        fail('landing west must mirror the current east-only sequence')
    for action, meta in manifest.items():
        if action != 'land' and (meta.get('mirrorEast') or meta.get('mirrorWest')):
            fail(f'{action}: unexpected mirroring')

    sword_actions = ('attack_1','attack_2','attack_3')
    if {manifest[a].get('rotationSource') for a in sword_actions} != {'sword_attack'}:
        fail('all sword attacks must share the protagonist sword rotation set')
    rotation_sources = {meta.get('rotationSource') or action for action, meta in manifest.items()}
    if len(rotation_sources) != 9:
        fail(f'expected 9 unique rotation sets, got {sorted(rotation_sources)}')
    for source in rotation_sources:
        stems = {p.stem for p in (OUT / source / 'rotations').glob('*.png')}
        if stems != set(DIRECTIONS):
            fail(f'{source}: rotation PNG coverage is incomplete')

    kept_current = current_non_attack_pngs()
    selected_today = sum((source_attack_pngs(a) for a in sword_actions), [])
    output_pngs = sorted(OUT.rglob('*.png'))
    expected = kept_current + selected_today
    if len(kept_current) != 201:
        fail(f'expected 201 preserved non-attack PNGs, found {len(kept_current)}')
    if len(selected_today) != 50:
        fail(f'expected 50 frames from today across three live strikes, found {len(selected_today)}')
    if len(output_pngs) != 251:
        fail(f'expected 251 production PNGs, found {len(output_pngs)}')
    if Counter(map(digest, expected)) != Counter(map(digest, output_pngs)):
        fail('production art is not the exact base-nonstrike + today-strike composition')
    if Counter(png_header(p) for p in expected) != Counter(png_header(p) for p in output_pngs):
        fail('production PNG dimensions/formats changed unexpectedly')

    print('Today-only sword strike artwork verification passed.')
    print('Live combo: Ko Gasumi forward cut -> upward slash -> 9-frame committed follow-through')
    print('All 50 live sword-strike frames come only from the two 2026-08-21 uploads.')
    print('Two exact duplicates of older wired attacks are intentionally excluded.')
    print('Production artwork: 251/251 PNGs match the intended composition.')


if __name__ == '__main__':
    main()
