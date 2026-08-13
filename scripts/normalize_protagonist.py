from pathlib import Path
import shutil, re, json, sys

root=Path('.pixellab-unpack')
out=Path('assets/v05/pixellab_protagonist')
frames=[p for p in root.rglob('frame_*.png') if '__MACOSX' not in p.parts]
if not frames:
    raise SystemExit('Updated protagonist archive contains no frame_*.png files')

def norm(p):
    return str(p).lower().replace('-','_').replace(' ','_')

def classify(p):
    s=norm(p)
    if 'death' in s or 'dying' in s or 'dead' in s: return 'death'
    if 'hit' in s or 'hurt' in s or 'knock' in s or 'damage' in s: return 'hit'
    if 'heavy' in s and ('attack' in s or 'sword' in s or 'swing' in s): return 'heavy_attack'
    if 'light' in s and ('attack' in s or 'sword' in s or 'swing' in s): return 'light_attack'
    if 'dash' in s or 'dodge' in s or 'roll' in s: return 'dash'
    if 'fall' in s: return 'fall'
    if 'jump' in s or 'leap' in s: return 'jump'
    if 'sprint' in s or 'running' in s or 'run' in s or 'walk' in s: return 'run'
    if 'idle' in s: return 'idle'
    if 'attack' in s or 'sword_attack' in s or 'swing' in s: return 'light_attack'
    return None

def frame_num(p):
    m=re.search(r'frame_(\d+)',p.stem,re.I)
    return int(m.group(1)) if m else 0

actions=('idle','run','jump','fall','light_attack','heavy_attack','dash','hit','death')
manifest={}
for action in actions:
    picked=[p for p in frames if classify(p)==action]
    if not picked:
        print('Archive frame paths:', file=sys.stderr)
        for p in frames: print(str(p), file=sys.stderr)
        raise SystemExit(f'Could not identify protagonist {action} frames')
    meta={}
    bydir={}
    for d in ('east','west'):
        seq=[p for p in picked if d in norm(p)]
        seq.sort(key=lambda p:(str(p.parent),frame_num(p)))
        bydir[d]=seq
    if not bydir['east'] and not bydir['west']:
        picked.sort(key=lambda p:(str(p.parent),frame_num(p)))
        bydir['east']=picked
    if not bydir['east']:
        bydir['east']=bydir['west']; meta['mirrorEast']=True
    if not bydir['west']:
        bydir['west']=bydir['east']; meta['mirrorWest']=True
    for d in ('east','west'):
        dest=out/action/d
        dest.mkdir(parents=True,exist_ok=True)
        for i,p in enumerate(bydir[d]):
            shutil.copy2(p,dest/f'frame_{i:03d}.png')
        meta[d]=len(bydir[d])
    manifest[action]=meta

(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
Path('src/pixellabManifest.js').write_text('export const PIXELLAB_MANIFEST = '+json.dumps(manifest,separators=(',',':'))+';\n')
print(json.dumps(manifest,indent=2))
