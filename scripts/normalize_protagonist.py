from pathlib import Path
import json
import re
import shutil
import sys
import zipfile

ARCHIVE = Path('Protagonist production sprites.zip')
EXTRACT_ROOT = Path('.protagonist-production')
OUT = Path('assets/v05/pixellab_protagonist')
MANIFEST_JS = Path('src/pixellabManifest.js')
DIRECTIONS = ('east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east')

# Canonical runtime names. Unknown future PixelLab states are still exported
# under a stable slug and included in the manifest as gameplay-unmapped assets.
STATE_ALIASES = {
    'idle': 'idle',
    'sprinting': 'run',
    'jump': 'jump',
    'falling': 'fall',
    'light sword attack': 'light_attack',
    'heavy sword attack.': 'heavy_attack',
    'heavy sword attack': 'heavy_attack',
    'dash': 'dash',
    'hit/knocked back': 'hit',
    'death': 'death',
}

DEFAULTS = {
    'idle': {'fps': 8, 'loop': True, 'gameplay': 'idle'},
    'run': {'fps': 14, 'loop': True, 'gameplay': 'running'},
    'jump': {'fps': 12, 'loop': False, 'gameplay': 'jumping'},
    'fall': {'fps': 12, 'loop': False, 'gameplay': 'falling'},
    'land': {'fps': 24, 'loop': False, 'gameplay': 'landing'},
    'light_attack': {'fps': 18, 'loop': False, 'gameplay': 'light attack'},
    'heavy_attack': {'fps': 16, 'loop': False, 'gameplay': 'heavy attack'},
    'dash': {'fps': 18, 'loop': False, 'gameplay': 'dodge / evade'},
    'hit': {'fps': 16, 'loop': False, 'gameplay': 'damage / knockback'},
    'death': {'fps': 10, 'loop': False, 'gameplay': 'death'},
}


def slug(value):
    value = value.strip().lower().replace('.', '')
    value = re.sub(r'[^a-z0-9]+', '_', value).strip('_')
    return value or 'animation'


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
        raise SystemExit(f'Missing approved protagonist archive: {ARCHIVE}')
    with zipfile.ZipFile(ARCHIVE) as archive:
        archive.extractall(EXTRACT_ROOT)


def resolve_source(base, relative_path):
    candidate = base / relative_path
    if candidate.exists():
        return candidate
    # PixelLab metadata paths are relative to the state folder. Keep this
    # fallback explicit so malformed metadata fails loudly instead of silently
    # selecting an unrelated PNG elsewhere in the archive.
    matches = [p for p in base.rglob(Path(relative_path).name) if str(p).endswith(relative_path)]
    if len(matches) == 1:
        return matches[0]
    raise FileNotFoundError(f'Cannot resolve metadata asset {relative_path!r} from {base}')


def copy_sequence(action, direction, sources):
    destination = OUT / action / direction
    destination.mkdir(parents=True, exist_ok=True)
    for old in destination.glob('frame_*.png'):
        old.unlink()
    ordered = sorted(sources, key=frame_number)
    for index, source in enumerate(ordered):
        shutil.copy2(source, destination / f'frame_{index:03d}.png')
    return len(ordered)


def copy_rotations(action, base, rotation_map):
    destination = OUT / action / 'rotations'
    destination.mkdir(parents=True, exist_ok=True)
    copied = []
    for direction in DIRECTIONS:
        relative_path = rotation_map.get(direction)
        if not relative_path:
            raise ValueError(f'{action}: missing rotation {direction}')
        source = resolve_source(base, relative_path)
        shutil.copy2(source, destination / f'{direction}.png')
        copied.append(direction)
    return copied


def register_action(manifest, action, east, west, *, source_state, source_animation,
                    rotation_source=None, rotations=None, source_frame_range=None,
                    mapped=True):
    if not east or not west:
        raise ValueError(f'{action}: both east and west animation sequences are required')
    meta = dict(DEFAULTS.get(action, {'fps': 12, 'loop': False, 'gameplay': None}))
    meta.update({
        'east': copy_sequence(action, 'east', east),
        'west': copy_sequence(action, 'west', west),
        'sourceState': source_state,
        'sourceAnimation': source_animation,
        'rotationSource': rotation_source or action,
        'rotations': list(rotations or DIRECTIONS),
        'mappedToGameplay': bool(mapped),
    })
    if source_frame_range is not None:
        meta['sourceFrameRange'] = list(source_frame_range)
    manifest[action] = meta


def main():
    clean_extract()
    metadata_files = sorted(p for p in EXTRACT_ROOT.rglob('metadata.json') if '__MACOSX' not in p.parts)
    if not metadata_files:
        raise SystemExit('No protagonist metadata.json files were found in the approved production archive.')

    manifest = {}
    discovered_states = []
    issues = []

    for metadata_path in metadata_files:
        try:
            metadata = json.loads(metadata_path.read_text())
        except Exception as exc:
            issues.append(f'{metadata_path}: invalid metadata JSON: {exc}')
            continue

        states = metadata.get('states') or []
        if not states:
            issues.append(f'{metadata_path}: no states[] in metadata')
            continue

        for state_index, state in enumerate(states):
            character = state.get('character') or {}
            state_name = str(character.get('name') or state.get('folder') or f'state_{state_index}')
            declared_directions = character.get('directions')
            if declared_directions != 8:
                issues.append(f'{state_name}: metadata declares directions={declared_directions!r}, expected 8')

            canonical = STATE_ALIASES.get(state_name.strip().lower(), slug(state_name))
            discovered_states.append((state_name, canonical))
            frames = state.get('frames') or {}
            animations = frames.get('animations') or {}
            rotation_map = frames.get('rotations') or {}
            state_base = metadata_path.parent

            if not animations:
                issues.append(f'{state_name}: no animations found')
                continue

            animation_items = list(animations.items())
            for animation_index, (animation_name, directional_frames) in enumerate(animation_items):
                action = canonical if animation_index == 0 else f'{canonical}_{slug(animation_name)}'
                mapped = action in DEFAULTS
                try:
                    east = [resolve_source(state_base, p) for p in directional_frames.get('east', [])]
                    west = [resolve_source(state_base, p) for p in directional_frames.get('west', [])]
                    rotations = copy_rotations(action, state_base, rotation_map)
                except Exception as exc:
                    issues.append(f'{state_name}/{animation_name}: {exc}')
                    continue

                # PixelLab supplied Falling as one animation explicitly named
                # "Falling_off_a_platform_landing_on_your_feet". Visual review
                # confirms frames 000-003 are airborne and 004-008 are the
                # touchdown/recovery. Preserve every source PNG byte-for-byte,
                # but expose those five touchdown poses as a landing state.
                if action == 'fall' and len(east) >= 6 and len(west) >= 6:
                    landing_count = min(5, len(east) - 1, len(west) - 1)
                    fall_east, land_east = east[:-landing_count], east[-landing_count:]
                    fall_west, land_west = west[:-landing_count], west[-landing_count:]
                    register_action(
                        manifest, 'fall', fall_east, fall_west,
                        source_state=state_name, source_animation=animation_name,
                        rotation_source='fall', rotations=rotations,
                        source_frame_range=(0, len(fall_east) - 1), mapped=True,
                    )
                    # Reuse the Falling rotation set by reference rather than
                    # duplicating or reloading identical rotation artwork.
                    register_action(
                        manifest, 'land', land_east, land_west,
                        source_state=state_name, source_animation=animation_name,
                        rotation_source='fall', rotations=rotations,
                        source_frame_range=(len(fall_east), len(east) - 1), mapped=True,
                    )
                else:
                    register_action(
                        manifest, action, east, west,
                        source_state=state_name, source_animation=animation_name,
                        rotation_source=action, rotations=rotations, mapped=mapped,
                    )

    required = ('idle', 'run', 'jump', 'fall', 'land', 'light_attack', 'heavy_attack', 'dash', 'hit', 'death')
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

    print('Approved protagonist archive:', ARCHIVE)
    print('Discovered states:')
    for source, canonical in discovered_states:
        print(f' - {source} -> {canonical}')
    print('Runtime manifest:')
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
