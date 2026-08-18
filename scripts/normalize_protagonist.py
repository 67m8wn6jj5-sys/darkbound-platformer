from pathlib import Path
import json
import re
import shutil
import struct
import sys
import zipfile
import zlib

ARCHIVE = Path('Sprite updates protagonist .zip')
EXTRACT_ROOT = Path('.protagonist-production')
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

# The latest Sword attack state contains three deliberately different sequences.
# Visual review establishes this combo order: quick sweep -> pivoting follow-up ->
# overhead/downward finisher. Keep every approved frame and expose all three.
SWORD_SEQUENCE_ACTIONS = {
    'The_character_shifts_their_weight_slightly_to_plan': 'attack_1',
    'The_warrior_pivots_his_hips_and_drives_his_sword_i': 'attack_2',
    'The_character_raises_their_sword_in_a_swift_powerf': 'attack_3',
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


def clean_extract():
    for path in (EXTRACT_ROOT, OUT):
        if path.exists():
            shutil.rmtree(path)
    EXTRACT_ROOT.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    if not ARCHIVE.exists():
        raise SystemExit(f'Missing latest protagonist archive: {ARCHIVE}')
    with zipfile.ZipFile(ARCHIVE) as archive:
        archive.extractall(EXTRACT_ROOT)


def resolve_source(relative_path):
    candidate = EXTRACT_ROOT / relative_path
    if candidate.exists():
        return candidate
    raise FileNotFoundError(f'Cannot resolve protagonist metadata asset: {relative_path!r}')


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
    """Read an 8-bit RGBA PNG without Pillow and find a stable visible baseline.

    Artwork remains byte-for-byte untouched. We only inspect alpha values to find
    the last row containing at least 10 meaningfully opaque pixels. This ignores
    isolated glow/spark pixels while following boots/body contact across mixed
    168/228/256 canvases. The resulting bottom padding is used at runtime to put
    that visual baseline on the unchanged Arcade-body foot line.
    """
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
    destination = OUT / rotation_source / 'rotations'
    destination.mkdir(parents=True, exist_ok=True)
    padding = {}
    canvas = {}
    for direction in DIRECTIONS:
        relative_path = rotation_map.get(direction)
        if not relative_path:
            raise ValueError(f'{rotation_source}: missing rotation {direction}')
        source = resolve_source(relative_path)
        shutil.copy2(source, destination / f'{direction}.png')
        metrics = png_ground_metrics(source)
        padding[direction] = metrics['bottomPadding']
        canvas[direction] = [metrics['width'], metrics['height']]
    return padding, canvas


def action_meta(action, source_state, source_animation, rotation_source, rotation_padding, rotation_canvas):
    meta = dict(DEFAULTS[action])
    meta.update({
        'sourceState': source_state,
        'sourceAnimation': source_animation,
        'rotationSource': rotation_source,
        'rotations': list(DIRECTIONS),
        'rotationBottomPadding': rotation_padding,
        'rotationCanvas': rotation_canvas,
        'mappedToGameplay': True,
    })
    return meta


def main():
    clean_extract()
    metadata_path = EXTRACT_ROOT / 'metadata.json'
    if not metadata_path.exists():
        raise SystemExit('Latest protagonist archive is missing root metadata.json')
    metadata = json.loads(metadata_path.read_text())
    states = metadata.get('states') or []
    if not states:
        raise SystemExit('Latest protagonist metadata contains no states[]')

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

        if state_name == 'Sword attack':
            rotation_source = 'sword_attack'
        else:
            rotation_source = STATE_ACTIONS.get(state_name)
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

        for animation_name, directional_frames in animations.items():
            if state_name == 'Sword attack':
                action = SWORD_SEQUENCE_ACTIONS.get(animation_name)
                if not action:
                    issues.append(f'Sword attack: unmapped animation {animation_name!r}')
                    continue
            else:
                action = STATE_ACTIONS[state_name]
                if action in manifest:
                    issues.append(f'{state_name}: multiple animations supplied unexpectedly')
                    continue

            try:
                east_sources = [resolve_source(p) for p in directional_frames.get('east', [])]
                west_sources = [resolve_source(p) for p in directional_frames.get('west', [])]
                if not east_sources:
                    raise ValueError('missing east animation frames')
                meta = action_meta(action, state_name, animation_name, rotation_source, rotation_padding, rotation_canvas)
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
                    # The 2026-08-18 export genuinely contains no west landing
                    # animation. Keep one copy of the approved east bytes and let
                    # the runtime mirror this single missing directional variant.
                    meta['west'] = 0
                    meta['mirrorWest'] = True
                    meta['mirrorSourceDirection'] = 'east'
                    meta['frameBottomPadding']['west'] = []
                    meta['frameCanvas']['west'] = []
                else:
                    raise ValueError('missing west animation frames')
                manifest[action] = meta
            except Exception as exc:
                issues.append(f'{state_name}/{animation_name}: {exc}')

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

    print('Latest protagonist archive:', ARCHIVE)
    print('Export date:', metadata.get('export_date'))
    print('Runtime actions:', ', '.join(manifest))
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
