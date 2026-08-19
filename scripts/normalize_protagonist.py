from pathlib import Path
import json
import re
import shutil
import struct
import sys
import zipfile
import zlib

BASE_ARCHIVE = Path('Sprite updates protagonist .zip')
ATTACK_ARCHIVE = Path('Protagonist update.zip')
BASE_ROOT = Path('.protagonist-production')
ATTACK_ROOT = Path('.protagonist-attack-replacements')
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

# All four older sword sequences are preserved. Three remain the canonical combo
# and the fourth is exposed as attack_alt for V18's controlled visual variation.
SWORD_SEQUENCE_ACTIONS = {
    'The_character_shifts_their_weight_forward_driving': 'attack_1',
    'The_warrior_pivots_his_hips_and_drives_his_sword_i': 'attack_2',
    'The_character_shifts_their_weight_forward_lifting': 'attack_3',
    'The_character_firmly_pivots_their_weight_onto_thei': 'attack_alt',
}

DEFAULTS = {
    'idle': {'fps': 8, 'loop': True, 'gameplay': 'idle'},
    'run': {'fps': 14, 'loop': True, 'gameplay': 'running'},
    'jump': {'fps': 12, 'loop': False, 'gameplay': 'jumping'},
    'fall': {'fps': 12, 'loop': False, 'gameplay': 'falling'},
    'land': {'fps': 24, 'loop': False, 'gameplay': 'landing'},
    'attack_1': {'fps': 18, 'loop': False, 'gameplay': 'combo attack 1'},
    'attack_2': {'fps': 18, 'loop': False, 'gameplay': 'combo attack 2'},
    'attack_3': {'fps': 16, 'loop': False, 'gameplay': 'combo attack 3 / heavy finisher'},
    'attack_alt': {'fps': 18, 'loop': False, 'gameplay': 'alternate combo visual'},
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


def resolve(root, relative):
    path = root / relative
    if not path.exists():
        raise FileNotFoundError(f'{root}: missing {relative}')
    return path


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


def copy_rotations(rotation_source, rotation_map):
    dest = OUT / rotation_source / 'rotations'
    dest.mkdir(parents=True, exist_ok=True)
    padding, canvas = {}, {}
    for direction in DIRECTIONS:
        relative = rotation_map.get(direction)
        if not relative:
            raise ValueError(f'{rotation_source}: missing rotation {direction}')
        source = resolve(BASE_ROOT, relative)
        shutil.copy2(source, dest / f'{direction}.png')
        width, height, bottom_padding = png_metrics(source)
        padding[direction] = bottom_padding
        canvas[direction] = [width, height]
    return padding, canvas


def copy_sequence(action, direction, relatives, source_root):
    sources = sorted((resolve(source_root, relative) for relative in relatives), key=frame_number)
    dest = OUT / action / direction
    dest.mkdir(parents=True, exist_ok=True)
    paddings, canvases = [], []
    for index, source in enumerate(sources):
        shutil.copy2(source, dest / f'frame_{index:03d}.png')
        width, height, bottom_padding = png_metrics(source)
        paddings.append(bottom_padding)
        canvases.append([width, height])
    return len(sources), paddings, canvases


def build_action(action, state_name, animation_name, directional, source_root, source_archive,
                 rotation_source, rotation_padding, rotation_canvas):
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
    east_count, east_padding, east_canvas = copy_sequence(action, 'east', directional.get('east') or [], source_root)
    meta['east'] = east_count
    meta['frameBottomPadding']['east'] = east_padding
    meta['frameCanvas']['east'] = east_canvas
    west_frames = directional.get('west') or []
    if west_frames:
        west_count, west_padding, west_canvas = copy_sequence(action, 'west', west_frames, source_root)
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
    extract(ATTACK_ARCHIVE, ATTACK_ROOT)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    base_metadata = json.loads((BASE_ROOT / 'metadata.json').read_text())
    attack_metadata = json.loads((ATTACK_ROOT / 'metadata.json').read_text())
    old_sword = find_state(attack_metadata, 'Sword attack')
    if not old_sword:
        fail('attack replacement archive has no Sword attack state')
    old_animations = ((old_sword.get('frames') or {}).get('animations') or {})
    if set(old_animations) != set(SWORD_SEQUENCE_ACTIONS):
        fail(f'old sword animation set changed: {sorted(old_animations)}')

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
                rotation_cache[rotation_source] = copy_rotations(rotation_source, rotations)
            except Exception as exc:
                issues.append(str(exc))
                continue
        rotation_padding, rotation_canvas = rotation_cache[rotation_source]

        if state_name == 'Sword attack':
            for animation_name, action in SWORD_SEQUENCE_ACTIONS.items():
                try:
                    manifest[action] = build_action(
                        action, state_name, animation_name, old_animations[animation_name],
                        ATTACK_ROOT, ATTACK_ARCHIVE.name,
                        rotation_source, rotation_padding, rotation_canvas
                    )
                except Exception as exc:
                    issues.append(str(exc))
            continue

        action = STATE_ACTIONS[state_name]
        if len(animations) != 1:
            issues.append(f'{state_name}: expected one animation, found {len(animations)}')
            continue
        animation_name, directional = next(iter(animations.items()))
        try:
            manifest[action] = build_action(
                action, state_name, animation_name, directional,
                BASE_ROOT, BASE_ARCHIVE.name,
                rotation_source, rotation_padding, rotation_canvas
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
    print('Current protagonist archive:', BASE_ARCHIVE)
    print('Attack replacement archive:', ATTACK_ARCHIVE)
    print('Runtime actions:', ', '.join(manifest))
    print('Sword visuals:', ', '.join(SWORD_SEQUENCE_ACTIONS.values()))


if __name__ == '__main__':
    main()
