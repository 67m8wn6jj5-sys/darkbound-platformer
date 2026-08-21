from pathlib import Path
import hashlib, json, zipfile

PACKS=[
 Path('Recreate_this_character-Ko_Gasumi_sword_atta.zip'),
 Path('Recreate_this_character-Sword_attack.zip'),
]
OLD=[Path('Protagonist update.zip'),Path('Sprite updates protagonist .zip')]

def meta_and_prefix(z):
    names=z.namelist()
    candidates=[n for n in names if n=='metadata.json' or n.endswith('/metadata.json')]
    if not candidates: return None,''
    m=min(candidates,key=len)
    return json.loads(z.read(m)), m[:-len('metadata.json')]

def resolve_name(z, rel, prefix):
    if rel in z.namelist(): return rel
    p=prefix+rel
    if p in z.namelist(): return p
    # tolerate metadata paths with/without top folder
    matches=[n for n in z.namelist() if n.endswith('/'+rel) or n==rel]
    if len(matches)==1:return matches[0]
    raise KeyError(rel)

def sequences(path):
    out=[]
    with zipfile.ZipFile(path) as z:
        meta,prefix=meta_and_prefix(z)
        if not meta:
            print(f'=== {path.name} === NO METADATA'); return out
        print(f'=== {path.name} ===')
        print('export_date=',meta.get('export_date'))
        for state in meta.get('states') or []:
            c=state.get('character') or {}
            state_name=str(c.get('name') or state.get('folder') or '')
            anims=((state.get('frames') or {}).get('animations') or {})
            if not anims: continue
            print('STATE',repr(state_name),'directions=',c.get('directions'))
            for anim,dirs in anims.items():
                h=hashlib.sha256(); counts={}
                for d in sorted(dirs):
                    rels=dirs.get(d) or []; counts[d]=len(rels); h.update(d.encode())
                    for rel in rels:
                        name=resolve_name(z,rel,prefix); b=z.read(name); h.update(hashlib.sha256(b).digest())
                sig=h.hexdigest()[:16]
                print(' ANIM',repr(anim),'counts=',counts,'sig=',sig)
                out.append((path.name,state_name,anim,counts,sig))
    return out

allseq=[]
for p in PACKS+OLD:
    if p.exists(): allseq += sequences(p)

print('=== DUPLICATE SIGNATURES ===')
by={}
for row in allseq:by.setdefault(row[4],[]).append(row)
for sig,rows in by.items():
    if len(rows)>1:
        print(sig)
        for r in rows:print(' ',r[0],repr(r[2]))
