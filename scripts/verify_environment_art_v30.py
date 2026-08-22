from pathlib import Path
import json
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'v30' / 'environment'
MANIFEST = OUT / 'manifest.json'
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
ORIGINAL_PLATFORM = 'pixellab-tileset-ancient-dark-gothic-stone-masonry-large-a89e3ba5.png'
REJECTED_PLATFORMS = [
    ROOT / 'pixellab-tileset-ancient-dark-gothic-stone-masonry-large-worn-cracked-stone-p-606f17e2.png',
    ROOT / 'pixellab-tileset-solid-ancient-gothic-fortress-stone-platform-flat-walkable-g-e686e8eb.png',
]


def fail(message):
    raise SystemExit(f'V30 ENVIRONMENT VERIFY FAILED: {message}')


def validate_png(path):
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != PNG_SIGNATURE or data[12:16] != b'IHDR':
        fail(f'invalid PNG: {path}')
    width, height = struct.unpack('>II', data[16:24])
    if width < 16 or height < 16 or width > 1024 or height > 1024:
        fail(f'unexpected dimensions for {path}: {width}x{height}')
    return width, height


def main():
    if not MANIFEST.exists():
        fail('manifest missing; run scripts/build_environment_v30.py first')
    manifest = json.loads(MANIFEST.read_text())
    expected = {'lights': 3, 'background': 12, 'arches': 5}
    for group, count in expected.items():
        records = manifest.get(group) or []
        if len(records) != count:
            fail(f'{group} count {len(records)} != {count}')
        for index, record in enumerate(records):
            path = ROOT / record['path']
            if not path.exists():
                fail(f'missing built asset: {path}')
            width, height = validate_png(path)
            if (width, height) != (record['width'], record['height']):
                fail(f'manifest dimensions disagree for {path}')
            if not record.get('sourceArchive', '').endswith('.zip'):
                fail(f'{group}[{index}] lost source archive provenance')
            if not record.get('sourceEntry', '').lower().endswith('.png'):
                fail(f'{group}[{index}] lost source PNG provenance')

    terrain = manifest.get('terrain') or {}
    if terrain.get('foreground') != ORIGINAL_PLATFORM:
        fail(f'foreground terrain must be the original approved gothic tileset, got {terrain.get("foreground")}')
    for role in ('foreground', 'background', 'architecture'):
        source = ROOT / terrain.get(role, '')
        if not source.exists():
            fail(f'{role} PixelLab tileset missing: {source}')
        validate_png(source)

    for rejected in REJECTED_PLATFORMS:
        if rejected.exists():
            fail(f'rejected platform tileset must be deleted from the repository: {rejected.name}')

    source = (ROOT / 'src' / 'GameSceneV30.js').read_text()
    if "extends GameSceneV29" not in source:
        fail('V30 must preserve V29 attack behavior')
    if ORIGINAL_PLATFORM not in source:
        fail('original approved gothic PixelLab terrain is not live')
    if '606f17e2' in source or 'e686e8eb' in source:
        fail('a rejected platform tileset is still referenced by live V30 code')
    if 'pixellab-tileset-ancient-recessed-gothic-dungeon-wall-masonry-965b1f4b.png' not in source:
        fail('recessed PixelLab background wall is not live')
    if 'assets/v30/environment/lights/' not in source or 'assets/v30/environment/background/' not in source or 'assets/v30/environment/arches/' not in source:
        fail('V30 does not preload all PixelLab object groups')
    if 'super.dressModularWorldV28' in source:
        fail('V30 must not render V28 placeholder room dressing underneath PixelLab art')
    for placeholder in ('this.createTorch(', 'this.createBackgroundArch(', 'this.createBrokenPillars(', 'this.createHangingChains('):
        if placeholder in source:
            fail(f'V30 still calls placeholder environment art: {placeholder}')
    if not re.search(r'ENVIRONMENT_ART_V30\.lights\.length', source):
        fail('V30 light selection is not driven by the PixelLab light set')

    main_source = (ROOT / 'src' / 'main.js').read_text()
    v31_source = (ROOT / 'src' / 'GameSceneV31.js').read_text()
    if "import { GameSceneV31 } from './GameSceneV31.js'" not in main_source or 'scene: [GameSceneV31]' not in main_source:
        fail('main.js does not boot V31')
    if 'GameSceneV31 -> GameSceneV30 -> GameSceneV29 -> GameSceneV28' not in main_source:
        fail('main.js does not document the preserved V31/V30/V29/V28 chain')
    if 'extends GameSceneV30' not in v31_source:
        fail('V31 must preserve the V30 art layer and V29 combat chain')

    print('V30/V31 PixelLab environment art verification passed.')
    print('Live terrain: original approved gothic foreground + recessed gothic background wall.')
    print('Both rejected platform tilesets are absent from the repository.')


if __name__ == '__main__':
    main()
