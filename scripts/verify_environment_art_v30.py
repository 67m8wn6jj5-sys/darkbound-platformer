from pathlib import Path
import json
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

def fail(message): raise SystemExit(f'ENVIRONMENT VERIFY FAILED: {message}')
def validate_png(path):
    data=path.read_bytes()
    if len(data)<24 or data[:8]!=PNG_SIGNATURE or data[12:16]!=b'IHDR': fail(f'invalid PNG: {path}')
    width,height=struct.unpack('>II',data[16:24])
    if width<16 or height<16 or width>1024 or height>1024: fail(f'unexpected dimensions for {path}: {width}x{height}')
    return width,height

def main():
    if not MANIFEST.exists(): fail('manifest missing; run scripts/build_environment_v30.py first')
    manifest=json.loads(MANIFEST.read_text())
    for group,count in {'lights':3,'background':12,'arches':5}.items():
        records=manifest.get(group) or []
        if len(records)!=count: fail(f'{group} count {len(records)} != {count}')
        for record in records:
            path=ROOT/record['path']
            if not path.exists(): fail(f'missing built asset: {path}')
            width,height=validate_png(path)
            if (width,height)!=(record['width'],record['height']): fail(f'manifest dimensions disagree for {path}')
            if not record.get('sourceArchive','').endswith('.zip'): fail(f'{group} asset lost archive provenance')
            if not record.get('sourceEntry','').lower().endswith('.png'): fail(f'{group} asset lost PNG provenance')

    terrain=manifest.get('terrain') or {}
    if terrain.get('foreground')!=ORIGINAL_PLATFORM: fail(f'foreground terrain must remain the original gothic tileset, got {terrain.get("foreground")}')
    for role in ('foreground','background','architecture'):
        source=ROOT/terrain.get(role,'')
        if not source.exists(): fail(f'{role} PixelLab tileset missing from repository: {source}')
        validate_png(source)
    for rejected in REJECTED_PLATFORMS:
        if rejected.exists(): fail(f'rejected platform tileset returned: {rejected.name}')

    v30=(ROOT/'src'/'GameSceneV30.js').read_text()
    if ORIGINAL_PLATFORM not in v30 or '606f17e2' in v30 or 'e686e8eb' in v30: fail('V30 foreground terrain references changed unexpectedly')
    for token in ('pixellab-tileset-ancient-recessed-gothic-dungeon-wall-masonry-965b1f4b.png','pixellab-tileset-ancient-gothic-stone-pillar-and-arch-masonry-919c3a88.png','assets/v30/environment/lights/','assets/v30/environment/background/','assets/v30/environment/arches/'):
        if token not in v30: fail(f'environment inventory reference missing: {token}')

    main_source=(ROOT/'src'/'main.js').read_text();v38=(ROOT/'src'/'GameSceneV38.js').read_text();v37=(ROOT/'src'/'GameSceneV37.js').read_text();v36=(ROOT/'src'/'GameSceneV36.js').read_text();v35=(ROOT/'src'/'GameSceneV35.js').read_text();v34=(ROOT/'src'/'GameSceneV34.js').read_text()
    if "import { GameSceneV38 } from './GameSceneV38.js'" not in main_source or 'scene: [GameSceneV38]' not in main_source: fail('main.js does not boot V38')
    if 'GameSceneV38 -> GameSceneV37 -> GameSceneV36 -> GameSceneV35 -> GameSceneV34 -> GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29' not in main_source: fail('main.js does not document the preserved V38 inheritance chain')
    if 'extends GameSceneV37' not in v38 or 'extends GameSceneV36' not in v37 or 'extends GameSceneV35' not in v36 or 'extends GameSceneV34' not in v35 or 'extends GameSceneV33' not in v34: fail('V38 must preserve the V37/V36/V35/V34/V33/combat runtime inheritance chain')
    for live in (v34,v35,v36,v38):
        if 'ENVIRONMENT_ART_V30.background.key' not in live or 'ENVIRONMENT_ART_V30.architecture.key' not in live: fail('live rendering layers must retain the approved background and architecture tilesets')
    if 'ENVIRONMENT_ART_V30.architecture.key' not in v37: fail('V37 reward altars must continue using approved architecture art')
    if 'ENVIRONMENT_ART_V30.backgroundObjects' not in v34 or 'ENVIRONMENT_ART_V30.backgroundObjects' not in v36: fail('live stack should retain restrained authored background-object accents')
    if any('ENVIRONMENT_ART_V30.arches' in live for live in (v34,v35,v36,v37,v38)): fail('live V34-V38 stack must not enlarge/reuse rejected incomplete arch-object exports')
    print('Environment inventory + V38 layered-world verification passed.')

if __name__=='__main__': main()
