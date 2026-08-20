from pathlib import Path
import json
import zipfile

archives=[
    Path('Protagonist production sprites.zip'),
    Path('Protagonist sprite updates.zip'),
    Path('Protagonist update.zip'),
    Path('Sprite updates protagonist .zip'),
]
for archive in archives:
    print(f'=== {archive} ===')
    if not archive.exists():
        print('MISSING')
        continue
    with zipfile.ZipFile(archive) as z:
        try:
            meta=json.loads(z.read('metadata.json'))
        except KeyError:
            names=z.namelist()
            candidate=next((n for n in names if n.endswith('/metadata.json') or n=='metadata.json'),None)
            if not candidate:
                print('NO METADATA')
                continue
            meta=json.loads(z.read(candidate))
        states=meta.get('states') or []
        sword=[]
        for state in states:
            character=state.get('character') or {}
            name=str(character.get('name') or state.get('folder') or '')
            if name!='Sword attack':
                continue
            animations=((state.get('frames') or {}).get('animations') or {})
            for anim,directions in animations.items():
                counts={d:len(frames or []) for d,frames in directions.items()}
                sword.append((anim,counts))
        if not sword:
            print('NO SWORD ATTACK STATE')
        for anim,counts in sword:
            print(anim)
            print(counts)
