from pathlib import Path
import json
import re
import shutil
import struct
import sys
import zipfile
import zlib

BASE_ARCHIVE = Path('Sprite updates protagonist .zip')
TODAY_SWORD_ARCHIVE = Path('Recreate_this_character-Sword_attack.zip')
TODAY_KO_ARCHIVE = Path('Recreate_this_character-Ko_Gasumi_sword_atta.zip')
BASE_ROOT = Path('.protagonist-production')
TODAY_SWORD_ROOT = Path('.protagonist-attacks-today-sword')
TODAY_KO_ROOT = Path('.protagonist-attacks-today-ko')
OUT = Path('assets/v05/pixellab_protagonist')
MANIFEST_JS = Path('src/pixellabManifest.js')
DIRECTIONS = ('east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east')

STATE_ACTIONS = {
    'Idle': 'idle',
    'Running full speed': 'run',
    'Leaping': 'jump',
    'Falling from a platf': 'fall',
    'Landing in the groun': 'land',
    'Taking a hit getting': 'hit',
    'Death': 'death',
    'Dash attack': 'dash',
}

# V27 rule: every live sword STRIKE must come from the two packs uploaded on
# 2026-08-21. Two animations in TODAY_SWORD_ARCHIVE are exact duplicates of
# older wired artwork and are intentionally excluded. The three genuinely new
# sequences are arranged as a readable light -> rising -> committed finisher
# combo. Gameplay timing/damage still belongs to the existing three combo steps.
KO_ATTACK_ANIMATION = 'The_warrior_shifts_his_weight_forward_tightening_h'
UPWARD_ATTACK_ANIMATION = 'Upward_sword_slash._Starting_from_the_feet_and_fin'
SWORD_PACK_ATTACK_ANIMATION = 'The_warrior_shifts_his_weight_forward_tightening_h'
EXCLUDED_DUPLICATE_ANIMATIONS = {
    'The_character_shifts_their_weight_slightly_to_plan',
    'The_character_raises_their_sword_in_a_swift_powerf',
}
EXPECTED_TODAY_SWORD_ANIMATIONS = EXCLUDED_DUPLICATE_ANIMATIONS | {
    UPWARD_ATTACK_ANIMATION,
    SWORD_PACK_ATTACK_ANIMATION,
}
EXPECTED_TODAY_KO_ANIMATIONS = {KO_ATTACK_ANIMATION}

DEFAULTS = {
    'idle': {'fps': 8, 'loop': True, 'gameplay': 'idle'},
    'run': {'fps': 14, 'loop': True, 'gameplay': 'running'},
    'jump': {'fps': 12, 'loop': False, 'gameplay': 'jumping'},
    'fall': {'fps': 12, 'loop': False, 'gameplay': 'falling'},
    'land': {'fps': 24, 'loop': False, 'gameplay': 'landing'},
    'attack_1': {'fps': 18, 'loop': False, 'gameplay': 'combo attack 1 / quick forward cut'},
    'attack_2': {'fps': 18, 'loop': False, 'gameplay': 'combo attack 2 / upward cut'},
    'attack_3': {'fps': 18, 'loop': False, 'gameplay': 'combo attack 3 / committed finisher'},
    'dash': {'fps': 18, 'loop': False, 'gameplay': 'dodge / evade'},
    'hit': {'fps': 16, 'loop': False, 'gameplay': 'damage / knockback'},
    'death': {'fps': 10, 'loop': False, 'gameplay': 'death'},
}


def fail(message):
    print(f'PROTAGONIST NORMALIZE FAILED: {message}', file=sys.stderr)
    raise SystemExit(1)


def frame_number(path):
    match = re.search(r'frame_(\d+)', path.name, re.I)
    return int(match.group(1)) if match else 0


def extract(archive, destination):
    if not archive.exists():
        fail(f'missing archive: {archive}')
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        z.extractall(destination)


def load_metadata(root):
    candidates = sorted(root.rglob('metadata.json'), key=lambda p: (len(p.parts), len(str(p))))
    if not candidates:
        fail(f'{root}: missing metadata.json')
    path = candidates[0]
    return json.loads(path.read_text()), path.parent


def resolve(root, metadata_dir, relative):
    relative = Path(relative)
    for candidate in (root / relative, metadata_dir / relative):
        if candidate.exists():
            return candidate
    matches = [p for p in root.rglob(relative.name) if str(p).replace('\\', '/').endswith(str(relative).replace('\\', '/'))]
    if len(matches) == 1:
        return matches[0]
    raise FileNotFoundError(f'{root}: missing {relative}')


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def png_metrics(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'{path}: not a PNG')
    pos = 8
    idat = bytearray()
    width = height = bit_depth = color_type = interlace = None
    while pos + 12 <= len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        payload = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b'IHDR':
            width, height, bit_depth, color_type, _c, _f, interlace = struct.unpack('>IIBBBBB', payload)
        elif kind == b'IDAT':
            idat.extend(payload)
        elif kind == b'IEND':
            break
    if (bit_depth, color_type, interlace) != (8, 6, 0):
        raise ValueError(f'{path}: expected non-interlaced 8-bit RGBA PNG')

    raw = zlib.decompress(bytes(idat))
    stride = width * 4
    if len(raw) != height * (stride + 1):
        raise ValueError(f'{path}: unexpected decompressed size')
    previous = bytearray(stride)
    cursor = 0
    robust_bottom = None
    any_bottom = None
    for y in range(height):
        filter_type = raw[cursor]
        cursor += 1
        scan = raw[cursor:cursor + stride]
        cursor += stride
        row = bytearray(stride)
        for x, value in enumerate(scan):
            left = row[x - 4] if x >= 4 else 0
            up = previous[x]
            upper_left = previous[x - 4] if x >= 4 else 0
            if filter_type == 0:
                result = value
            elif filter_type == 1:
                result = (value + left) & 255
            elif filter_type == 2:
                result = (value + up) & 255
            elif filter_type == 3:
                result = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                result = (value + paeth(left, up, upper_left)) & 255
            else:
                raise ValueError(f'{path}: unsupported PNG filter {filter_type}')
            row[x] = result
        alpha = [row[x] for x in range(3, stride, 4)]
        if any(alpha):
            any_bottom = y
        if sum(1 for value in alpha if value >= 32) >= 10:
            robust_bottom = y
        previous = row
    bottom = robust_bottom if robust_bottom is not None else any_bottom
    if bottom is None:
        raise ValueError(f'{path}: fully transparent')
    return width, height, height - 1 - bottom


def find_state(metadata, wanted):
    for state in metadata.get('states') or []:
        character = state.get('character') or {}
        name = str(character.get('name') or state.get('folder') or '')
        if name == wanted:
            return state
    return None


def copy_rotations(rotation_source, rotation_map, source_root, metadata_dir):
    dest = OUT / rotation_source / 'rotations'
    dest.mkdir(parents=True, exist_ok=True)
    padding, canvas = {}, {}
    for direction in DIRECTIONS:
        relative = rotation_map.get(direction)
        if not relative:
            raise ValueError(f'{rotation_source}: missing rotation {direction}')
        source = resolve(source_root, metadata_dir, relative)
        shutil.copy2(source, dest / f'{direction}.png')
        width, height, bottom_padding = png_metrics(source)
        padding[direction] = bottom_padding
        canvas[direction] = [width, height]
    return padding, canvas


def copy_sequence(action, direction, relatives, source_root, metadata_dir):
    sources = sorted((resolve(source_root, metadata_dir, relative) for relative in relatives), key=frame_number)
    dest = OUT / action / direction
    dest.mkdir(parents=True, exist_ok=True)
    paddings, canvases = [], []
    for index, source in enumerate(sources):
        shutil.copy2(source, dest / f'frame_{index:03d}.png')
        width, height, bottom_padding = png_metrics(source)
        paddings.append(bottom_padding)
        canvases.append([width, height])
    return len(sources), paddings, canvases


def build_action(action, state_name, animation_name, directional, source_root, metadata_dir,
                 source_archive, rotation_source, rotation_padding, rotation_canvas):
    if not directional.get('east'):
        raise ValueError(f'{action}: missing east frames')
    meta = dict(DEFAULTS[action])
    meta.update({
        'sourceState': state_name,
        'sourceAnimation': animation_name,
        'sourceArchive': source_archive,
        'rotationSource': rotation_source,
        'rotationArchive': BASE_ARCHIVE.name,
        'rotations': list(DIRECTIONS),
        'rotationBottomPadding': rotation_padding,
        'rotationCanvas': rotation_canvas,
        'mappedToGameplay': True,
        'frameBottomPadding': {},
        'frameCanvas': {},
    })
    east_count, east_padding, east_canvas = copy_sequence(
        action, 'east', directional.get('east') or [], source_root, metadata_dir
    )
    meta['east'] = east_count
    meta['frameBottomPadding']['east'] = east_padding
    meta['frameCanvas']['east'] = east_canvas
    west_frames = directional.get('west') or []
    if west_frames:
        west_count, west_padding, west_canvas = copy_sequence(
            action, 'west', west_frames, source_root, metadata_dir
        )
        meta['west'] = west_count
        meta['frameBottomPadding']['west'] = west_padding
        meta['frameCanvas']['west'] = west_canvas
    elif action == 'land':
        meta['west'] = 0
        meta['frameBottomPadding']['west'] = []
        meta['frameCanvas']['west'] = []
        meta['mirrorWest'] = True
        meta['mirrorSourceDirection'] = 'east'
    else:
        raise ValueError(f'{action}: missing west frames')
    return meta


def main():
    extract(BASE_ARCHIVE, BASE_ROOT)
    extract(TODAY_SWORD_ARCHIVE, TODAY_SWORD_ROOT)
    extract(TODAY_KO_ARCHIVE, TODAY_KO_ROOT)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    base_metadata, base_meta_dir = load_metadata(BASE_ROOT)
    sword_metadata, sword_meta_dir = load_metadata(TODAY_SWORD_ROOT)
    ko_metadata, ko_meta_dir = load_metadata(TODAY_KO_ROOT)

    base_sword = find_state(base_metadata, 'Sword attack')
    today_sword = find_state(sword_metadata, 'Sword attack')
    today_ko = find_state(ko_metadata, 'Ko Gasumi sword atta')
    if not base_sword:
        fail('current protagonist archive has no Sword attack state for rotations')
    if not today_sword:
        fail('today Sword_attack pack has no Sword attack state')
    if not today_ko:
        fail('today Ko Gasumi pack has no Ko Gasumi sword atta state')

    sword_animations = ((today_sword.get('frames') or {}).get('animations') or {})
    ko_animations = ((today_ko.get('frames') or {}).get('animations') or {})
    if set(sword_animations) != EXPECTED_TODAY_SWORD_ANIMATIONS:
        fail(f'today sword animation set changed: {sorted(sword_animations)}')
    if set(ko_animations) != EXPECTED_TODAY_KO_ANIMATIONS:
        fail(f'today Ko animation set changed: {sorted(ko_animations)}')

    manifest = {}
    rotation_cache = {}
    issues = []

    for state in base_metadata.get('states') or []:
        character = state.get('character') or {}
        state_name = str(character.get('name') or state.get('folder') or '')
        if character.get('directions') != 8:
            issues.append(f'{state_name}: expected 8 directions')
            continue
        frames = state.get('frames') or {}
        animations = frames.get('animations') or {}
        rotations = frames.get('rotations') or {}
        rotation_source = 'sword_attack' if state_name == 'Sword attack' else STATE_ACTIONS.get(state_name)
        if not rotation_source:
            issues.append(f'unknown state {state_name!r}')
            continue
        if rotation_source not in rotation_cache:
            try:
                rotation_cache[rotation_source] = copy_rotations(
                    rotation_source, rotations, BASE_ROOT, base_meta_dir
                )
            except Exception as exc:
                issues.append(str(exc))
                continue
        rotation_padding, rotation_canvas = rotation_cache[rotation_source]

        if state_name == 'Sword attack':
            continue

        action = STATE_ACTIONS[state_name]
        if len(animations) != 1:
            issues.append(f'{state_name}: expected one animation, found {len(animations)}')
            continue
        animation_name, directional = next(iter(animations.items()))
        try:
            manifest[action] = build_action(
                action, state_name, animation_name, directional,
                BASE_ROOT, base_meta_dir, BASE_ARCHIVE.name,
                rotation_source, rotation_padding, rotation_canvas
            )
        except Exception as exc:
            issues.append(str(exc))

    if 'sword_attack' not in rotation_cache:
        issues.append('missing sword rotation set')
    else:
        rotation_padding, rotation_canvas = rotation_cache['sword_attack']
        attack_specs = (
            ('attack_1', 'Ko Gasumi sword atta', KO_ATTACK_ANIMATION,
             ko_animations[KO_ATTACK_ANIMATION], TODAY_KO_ROOT, ko_meta_dir, TODAY_KO_ARCHIVE.name),
            ('attack_2', 'Sword attack', UPWARD_ATTACK_ANIMATION,
             sword_animations[UPWARD_ATTACK_ANIMATION], TODAY_SWORD_ROOT, sword_meta_dir, TODAY_SWORD_ARCHIVE.name),
            ('attack_3', 'Sword attack', SWORD_PACK_ATTACK_ANIMATION,
             sword_animations[SWORD_PACK_ATTACK_ANIMATION], TODAY_SWORD_ROOT, sword_meta_dir, TODAY_SWORD_ARCHIVE.name),
        )
        for action, state_name, animation_name, directional, root, meta_dir, archive_name in attack_specs:
            try:
                manifest[action] = build_action(
                    action, state_name, animation_name, directional,
                    root, meta_dir, archive_name,
                    'sword_attack', rotation_padding, rotation_canvas
                )
            except Exception as exc:
                issues.append(str(exc))

    required = set(DEFAULTS)
    missing = sorted(required - set(manifest))
    extra = sorted(set(manifest) - required)
    if missing:
        issues.append('missing runtime actions: ' + ', '.join(missing))
    if extra:
        issues.append('unexpected runtime actions: ' + ', '.join(extra))
    if issues:
        print('Protagonist archive validation failed:', file=sys.stderr)
        for issue in issues:
            print(f' - {issue}', file=sys.stderr)
        raise SystemExit(1)

    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    MANIFEST_JS.write_text('export const PIXELLAB_MANIFEST = ' + json.dumps(manifest, separators=(',', ':')) + ';\n')
    print('Current non-attack protagonist archive:', BASE_ARCHIVE)
    print('Today attack archives:', TODAY_KO_ARCHIVE, 'and', TODAY_SWORD_ARCHIVE)
    print('Runtime actions:', ', '.join(manifest))
    print('Live sword combo: Ko Gasumi forward cut -> upward slash -> 9-frame committed follow-through')
    print('Excluded exact duplicates:', ', '.join(sorted(EXCLUDED_DUPLICATE_ANIMATIONS)))


if __name__ == '__main__':
    main()
