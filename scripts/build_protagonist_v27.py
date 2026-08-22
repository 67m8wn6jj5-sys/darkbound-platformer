from pathlib import Path
import json
import shutil

import normalize_protagonist as base
import build_environment_v30

# V27 deliberately restores the approved overhead/downward sword animation from
# the current protagonist archive as attack_3. attack_1 and attack_2 remain the
# forward and upward strikes from the 2026-08-21 attack uploads.
DOWNWARD_FINISHER_ANIMATION = 'The_character_raises_their_sword_in_a_swift_powerf'
EXPECTED_BASE_SWORD_ANIMATIONS = {
    'The_character_shifts_their_weight_slightly_to_plan',
    'The_warrior_pivots_his_hips_and_drives_his_sword_i',
    DOWNWARD_FINISHER_ANIMATION,
}


def fail(message):
    raise SystemExit(f'V27 PROTAGONIST BUILD FAILED: {message}')


def apply_downward_finisher():
    metadata, metadata_dir = base.load_metadata(base.BASE_ROOT)
    state = base.find_state(metadata, 'Sword attack')
    if not state:
        fail('current protagonist archive has no Sword attack state')

    animations = ((state.get('frames') or {}).get('animations') or {})
    if set(animations) != EXPECTED_BASE_SWORD_ANIMATIONS:
        fail(f'current Sword attack animation set changed: {sorted(animations)}')

    directional = animations[DOWNWARD_FINISHER_ANIMATION]
    attack_dir = base.OUT / 'attack_3'
    if attack_dir.exists():
        shutil.rmtree(attack_dir)

    east_count, east_padding, east_canvas = base.copy_sequence(
        'attack_3', 'east', directional.get('east') or [], base.BASE_ROOT, metadata_dir
    )
    west_count, west_padding, west_canvas = base.copy_sequence(
        'attack_3', 'west', directional.get('west') or [], base.BASE_ROOT, metadata_dir
    )
    if (east_count, west_count) != (8, 8):
        fail(f'downward finisher frame count changed: east={east_count} west={west_count}')

    manifest_path = base.OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    attack = manifest['attack_3']
    attack.update({
        'fps': 16,
        'loop': False,
        'gameplay': 'combo attack 3 / grounded and airborne downward finisher',
        'sourceState': 'Sword attack',
        'sourceAnimation': DOWNWARD_FINISHER_ANIMATION,
        'sourceArchive': base.BASE_ARCHIVE.name,
        'east': east_count,
        'west': west_count,
        'frameBottomPadding': {'east': east_padding, 'west': west_padding},
        'frameCanvas': {'east': east_canvas, 'west': west_canvas},
    })
    attack.pop('mirrorEast', None)
    attack.pop('mirrorWest', None)
    attack.pop('mirrorSourceDirection', None)

    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    base.MANIFEST_JS.write_text(
        'export const PIXELLAB_MANIFEST = ' + json.dumps(manifest, separators=(',', ':')) + ';\n'
    )
    print('V27 sword combo: today forward cut -> today upward cut -> restored overhead/downward finisher')
    print('Downward finisher source:', base.BASE_ARCHIVE, '/', DOWNWARD_FINISHER_ANIMATION)
    print('Downward finisher frames: 8 east + 8 west')


def main():
    base.main()
    apply_downward_finisher()
    # Pages and the primary CI workflow already invoke this shared asset-build
    # entry point, so build the uploaded PixelLab environment objects here too.
    build_environment_v30.main()


if __name__ == '__main__':
    main()
