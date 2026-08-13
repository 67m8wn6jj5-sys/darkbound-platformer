from pathlib import Path
import shutil, re, json, sys

base_root=Path('.pixellab-base')
update_root=Path('.pixellab-unpack')
out=Path('assets/v05/pixellab_protagonist')

def norm(p):
    return str(p).lower().replace('-','_').replace(' ','_')

def frame_num(p):
    m=re.search(r'frame_(\d+)',p.stem,re.I)
    return int(m.group(1)) if m else 0

def classify_base(p):
    s=norm(p)
    if 'death' in s or 'dying' in s or 'dead' in s: return 'death'
    if 'hit' in s or 'hurt' in s or 'knock' in s or 'damage' in s: return 'hit'
    if 'heavy' in s and ('attack' in s or 'sword' in s or 'swing' in s): return 'heavy_attack'
    if 'light' in s and ('attack' in s or 'sword' in s or 'swing' in s): return 'light_attack'
    if 'dash' in s or 'dodge' in s or 'roll' in s: return 'dash'
    if 'fall' in s: return 'fall'
    if 'jump' in s or 'leap' in s: return 'jump'
    if 'sprint' in s or 'running' in s or '/run/' in s: return 'run'
    if 'idle' in s: return 'idle'
    return None

def classify_update(p):
    s=norm(p)
    if 'attack_2' in s or 'attack2' in s: return 'heavy_attack'
    if '/attack/' in s or '\\attack\\' in s: return 'light_attack'
    if 'running' in s or 'sprinting' in s: return 'run'
    if '/jump/' in s or '\\jump\\' in s: return 'jump'
    return None

def collect(root,classifier):
    frames=[p for p in root.rglob('frame_*.png') if '__MACOSX' not in p.parts]
    result={}
    for p in frames:
        action=classifier(p)
        if action: result.setdefault(action,[]).append(p)
    return result

def build_action(action,picked):
    meta={}; bydir={}
    for d in ('east','west'):
        seq=[p for p in picked if d in norm(p)]
        seq.sort(key=lambda p:(str(p.parent),frame_num(p)))
        bydir[d]=seq
    if not bydir['east'] and not bydir['west']:
        picked=sorted(picked,key=lambda p:(str(p.parent),frame_num(p)))
        bydir['east']=picked
    if not bydir['east']:
        bydir['east']=bydir['west']; meta['mirrorEast']=True
    if not bydir['west']:
        bydir['west']=bydir['east']; meta['mirrorWest']=True
    for d in ('east','west'):
        dest=out/action/d
        dest.mkdir(parents=True,exist_ok=True)
        for old in dest.glob('frame_*.png'): old.unlink()
        for i,p in enumerate(bydir[d]): shutil.copy2(p,dest/f'frame_{i:03d}.png')
        meta[d]=len(bydir[d])
    return meta

base=collect(base_root,classify_base)
updates=collect(update_root,classify_update)
actions=('idle','run','jump','fall','light_attack','heavy_attack','dash','hit','death')
manifest={}
for action in actions:
    picked=updates.get(action) or base.get(action)
    if not picked:
        print(f'Missing protagonist action: {action}',file=sys.stderr)
        raise SystemExit(1)
    manifest[action]=build_action(action,picked)

(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
Path('src/pixellabManifest.js').write_text('export const PIXELLAB_MANIFEST = '+json.dumps(manifest,separators=(',',':'))+';\n')
print('Updated actions:', sorted(updates))
print(json.dumps(manifest,indent=2))
