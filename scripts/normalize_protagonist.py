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
EXTRACT_ROOT = Path('.protagonist-production')
ATTACK_EXTRACT_ROOT = Path('.protagonist-attack-replacements')
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

# Restore the three pre-2026-08-18 Sword attack sequences that form the intended
# gameplay combo. The older export also contains one alternate swing; it is
# intentionally not mapped because gameplay has exactly three combo steps.
SWORD_SEQUENCE_ACTIONS = {
    'The_character_shifts_their_weight_forward_driving': 'attack_1',
    'The_warrior_pivots_his_hips_and_drives_his_sword_i': 'attack_2',
    'The_character_shifts_their_weight_forward_lifting': 'attack_3',
}
IGNORED_OLD_SWORD_SEQUENCES = {
    'The_character_firmly_pivots_their_weight_onto_thei',
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
    'dash': {'fps': 18, 'loop': False, 'gameplay': 'dodge / evade'},
    'hit': {'fps': 16, 'loop': False, 'gameplay': 'damage / knockback'},
    'death': {'fps': 10, 'loop': False, 'gameplay': 'death'},
}


def frame_number(path):
    match = re.search(r'frame_(\d+)', path.name, re.I)
    return int(match.group(1)) if match else 0


def extract_archive(archive_path, destination):
    if not archive_path.exists():
        raise SystemExit(f'Missing protagonist archive: {archive_path}')
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        archive.extractall(destination)


def clean_extract():
    for path in (EXTRACT_ROOT, ATTACK_EXTRACT_ROOT, OUT):
        if path.exists():
            shutil.rmtree(path)
    extract_archive(BASE_ARCHIVE, EXTRACT_ROOT)
    extract_archive(ATTACK_ARCHIVE, ATTACK_EXTRACT_ROOT)
    OUT.mkdir(parents=True, exist_ok=True)


def resolve_source(relative_path, source_root=EXTRACT_ROOT):
    candidate = source_root / relative_path
    if candidate.exists():
        return candidate
    raise FileNotFoundError(f'Cannot resolve protagonist metadata asset in {source_root}: {relative_path!r}')


def paeth(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def png_ground_metrics(path):
    """Read an 8-bit RGBA PNG and find a stable visible bottom without editing art."""
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'{path}: not a PNG')
    pos = 8
    idat = bytearray()
    width = height = bit_depth = color_type = interlace = None
    while pos + 12 <= len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        chunk_type = data[pos + 4:pos + 8]
        payload = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if chunk_type == b'IHDR':
            width, height, bit_depth, color_type, _comp, _filter, interlace = struct.unpack('>IIBBBBB', payload)
        elif chunk_type == b'IDAT':
            idat.extend(payload)
        elif chunk_type == b'IEND':
            break

    if (bit_depth, color_type, interlace) != (8, 6, 0):
        raise ValueError(f'{path}: expected non-interlaced 8-bit RGBA PNG, got bit_depth={bit_depth}, color_type={color_type}, interlace={interlace}')

    raw = zlib.decompress(bytes(idat))
    bpp = 4
    stride = width * bpp
    expected = height * (stride + 1)
    if len(raw) != expected:
        raise ValueError(f'{path}: unexpected decompressed PNG size {len(raw)} != {expected}')

    previous = bytearray(stride)
    robust_bottom = None
    any_bottom = None
    cursor = 0
    for y in range(height):
        filter_type = raw[cursor]
        cursor += 1
        scan = raw[cursor:cursor + stride]
        cursor += stride
        row = bytearray(stride)
        for x, value in enumerate(scan):
            left = row[x - bpp] if x >= bpp else 0
            up = previous[x]
            upper_left = previous[x - bpp] if x >= bpp else 0
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

        alpha_count = 0
        any_alpha = False
        for x in range(3, stride, 4):
            alpha = row[x]
            if alpha:
                any_alpha = True
            if alpha >= 32:
                alpha_count += 1
        if any_alpha:
            any_bottom = y
        if alpha_count >= 10:
            robust_bottom = y
        previous = row

    ground_bottom = robust_bottom if robust_bottom is not None else any_bottom
    if ground_bottom is None:
        raise ValueError(f'{path}: fully transparent PNG')
    return {
        'width': width,
        'height': height,
        'groundBottom': ground_bottom,
        'bottomPadding': height - 1 - ground_bottom,
    }


def sequence_metrics(sources):
    return [png_ground_metrics(source) for source in sources]


def copy_sequence(action, direction, sources):
    ordered = sorted(sources, key=frame_number)
    destination = OUT / action / direction
    destination.mkdir(parents=True, exist_ok=True)
    for index, source in enumerate(ordered):
        shutil.copy2(source, destination / f'frame_{index:03d}.png')
    metrics = sequence_metrics(ordered)
    return {
        'count': len(ordered),
        'bottomPadding': [m['bottomPadding'] for m in metrics],
        'canvas': [[m['width'], m['height']] for m in metrics],
    }


def copy_rotations(rotation_source, rotation_map):
    """Always keep the current Aug-18 rotation art, including sword rotations."""
    destination = OUT / rotation_source / 'rotations'
    destination.mkdir(parents=True, exist_ok=True)
    padding = {}
    canvas = {}
    for direction in DIRECTIONS:
        relative_path = rotation_map.get(direction)
        if not relative_path:
            raise ValueError(f'{rotation_source}: missing rotation {direction}')
        source = resolve_source(relative_path, EXTRACT_ROOT)
        shutil.copy2(source, destination / f'{direction}.png')
        metrics = png_ground_metrics(source)
        padding[direction] = metrics['bottomPadding']
        canvas[direction] = [metrics['width'], metrics['height']]
    return padding, canvas


def action_meta(action, source_state, source_animation, source_archive, rotation_source, rotation_padding, rotation_canvas):
    meta = dict(DEFAULTS[action])
    meta.update({
        'sourceState': source_state,
        'sourceAnimation': source_animation,
        'sourceArchive': source_archive,
        'rotationSource': rotation_source,
        'rotationArchive': BASE_ARCHIVE.name,
        'rotations': list(DIRECTIONS),
        'rotationBottomPadding': rotation_padding,
        'rotationCanvas': rotation_canvas,
        'mappedToGameplay': True,
    })
    return meta


def find_state(metadata, wanted_name):
    for state in metadata.get('states') or []:
        character = state.get('character') or {}
        state_name = str(character.get('name') or state.get('folder') or '')
        if state_name == wanted_name:
            return state
    return None


def copy_animation_action(action, state_name, animation_name, directional_frames, source_root, source_archive,
                          rotation_source, rotation_padding, rotation_canvas, issues):
    try:
        east_sources = [resolve_source(p, source_root) for p in directional_frames.get('east', [])]
        west_sources = [resolve_source(p, source_root) for p in directional_frames.get('west', [])]
        if not east_sources:
            raise ValueError('missing east animation frames')
        meta = action_meta(
            action, state_name, animation_name, source_archive,
            rotation_source, rotation_padding, rotation_canvas
        )
        east = copy_sequence(action, 'east', east_sources)
        meta['east'] = east['count']
        meta.setdefault('frameBottomPadding', {})['east'] = east['bottomPadding']
        meta.setdefault('frameCanvas', {})['east'] = east['canvas']

        if west_sources:
            west = copy_sequence(action, 'west', west_sources)
            meta['west'] = west['count']
            meta['frameBottomPadding']['west'] = west['bottomPadding']
            meta['frameCanvas']['west'] = west['canvas']
        elif action == 'land':
            meta['west'] = 0
            meta['mirrorWest'] = True
            meta['mirrorSourceDirection'] = 'east'
            meta['frameBottomPadding']['west'] = []
            meta['frameCanvas']['west'] = []
        else:
            raise ValueError('missing west animation frames')
        return meta
    except Exception as exc:
        issues.append(f'{state_name}/{animation_name}: {exc}')
        return None


def main():
    clean_extract()
    base_metadata_path = EXTRACT_ROOT / 'metadata.json'
    attack_metadata_path = ATTACK_EXTRACT_ROOT / 'metadata.json'
    if not base_metadata_path.exists():
        raise SystemExit(f'{BASE_ARCHIVE} is missing root metadata.json')
    if not attack_metadata_path.exists():
        raise SystemExit(f'{ATTACK_ARCHIVE} is missing root metadata.json')

    base_metadata = json.loads(base_metadata_path.read_text())
    attack_metadata = json.loads(attack_metadata_path.read_text())
    states = base_metadata.get('states') or []
    if not states:
        raise SystemExit('Current protagonist metadata contains no states[]')
    old_sword_state = find_state(attack_metadata, 'Sword attack')
    if not old_sword_state:
        raise SystemExit(f'{ATTACK_ARCHIVE} contains no Sword attack state')

    manifest = {}
    issues = []
    copied_rotation_sources = {}

    for state in states:
        character = state.get('character') or {}
        state_name = str(character.get('name') or state.get('folder') or '')
        if character.get('directions') != 8:
            issues.append(f'{state_name}: expected 8 directions, found {character.get("directions")!r}')
        frames = state.get('frames') or {}
        animations = frames.get('animations') or {}
        rotation_map = frames.get('rotations') or {}
        if not animations:
            issues.append(f'{state_name}: no animation sequences found')
            continue

        rotation_source = 'sword_attack' if state_name == 'Sword attack' else STATE_ACTIONS.get(state_name)
        if not rotation_source:
            issues.append(f'Unknown protagonist state: {state_name!r}')
            continue

        if rotation_source not in copied_rotation_sources:
            try:
                copied_rotation_sources[rotation_source] = copy_rotations(rotation_source, rotation_map)
            except Exception as exc:
                issues.append(f'{state_name} rotations: {exc}')
                continue
        rotation_padding, rotation_canvas = copied_rotation_sources[rotation_source]

        if state_name == 'Sword attack':
            old_character = old_sword_state.get('character') or {}
            if old_character.get('directions') != 8:
                issues.append(f'Old Sword attack: expected 8 directions, found {old_character.get("directions")!r}')
            old_animations = ((old_sword_state.get('frames') or {}).get('animations') or {})
            seen = set(old_animations)
            expected = set(SWORD_SEQUENCE_ACTIONS) | IGNORED_OLD_SWORD_SEQUENCES
            unexpected = sorted(seen - expected)
            missing_old = sorted(set(SWORD_SEQUENCE_ACTIONS) - seen)
            if unexpected:
                issues.append('Old Sword attack contains unexpected animations: ' + ', '.join(unexpected))
            if missing_old:
                issues.append('Old Sword attack is missing required animations: ' + ', '.join(missing_old))
            for animation_name, action in SWORD_SEQUENCE_ACTIONS.items():
                directional_frames = old_animations.get(animation_name)
                if not directional_frames:
                    continue
                meta = copy_animation_action(
                    action, 'Sword attack', animation_name, directional_frames,
                    ATTACK_EXTRACT_ROOT, ATTACK_ARCHIVE.name,
                    rotation_source, rotation_padding, rotation_canvas, issues
                )
                if meta:
                    manifest[action] = meta
            continue

        action = STATE_ACTIONS[state_name]
        if len(animations) != 1:
            issues.append(f'{state_name}: expected exactly one current animation, found {len(animations)}')
            continue
        animation_name, directional_frames = next(iter(animations.items()))
        meta = copy_animation_action(
            action, state_name, animation_name, directional_frames,
            EXTRACT_ROOT, BASE_ARCHIVE.name,
            rotation_source, rotation_padding, rotation_canvas, issues
        )
        if meta:
            manifest[action] = meta

    required = ('idle', 'run', 'jump', 'fall', 'land', 'attack_1', 'attack_2', 'attack_3', 'dash', 'hit', 'death')
    missing = [action for action in required if action not in manifest]
    if missing:
        issues.append('Missing required runtime actions: ' + ', '.join(missing))

    if issues:
        print('Protagonist archive validation failed:', file=sys.stderr)
        for issue in issues:
            print(f' - {issue}', file=sys.stderr)
        raise SystemExit(1)

    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    MANIFEST_JS.write_text(
        'export const PIXELLAB_MANIFEST = ' + json.dumps(manifest, separators=(',', ':')) + ';\n'
    )

    print('Current protagonist archive:', BASE_ARCHIVE)
    print('Current export date:', base_metadata.get('export_date'))
    print('Attack replacement archive:', ATTACK_ARCHIVE)
    print('Attack export date:', attack_metadata.get('export_date'))
    print('Runtime actions:', ', '.join(manifest))
    print('Restored attack animations:', ', '.join(SWORD_SEQUENCE_ACTIONS))
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
