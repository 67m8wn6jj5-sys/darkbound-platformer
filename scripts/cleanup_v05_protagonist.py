from pathlib import Path

path = Path('src/GameSceneV05.js')
text = path.read_text()
replacements = [
    ("const FALLBACK_ASSET_ROOT='./assets/v05/production58',PIXELLAB_ROOT='./assets/v05/pixellab_protagonist',ENEMY1_ROOT='./assets/v05/enemy1';", "const PIXELLAB_ROOT='./assets/v05/pixellab_protagonist',ENEMY1_ROOT='./assets/v05/enemy1';"),
    ("const ART_SCALE=.38,PIXELLAB_SCALE=1,PIXELLAB_ART_Y=72,ENEMY1_SCALE=1.4688,ENEMY1_ART_Y=66,ATTACK_LUNGE=[90,115,145],ATTACK_RECOIL=[28,36,48];", "const PIXELLAB_SCALE=1,PIXELLAB_ART_Y=72,ENEMY1_SCALE=1.4688,ENEMY1_ART_Y=66,ATTACK_LUNGE=[90,115,145],ATTACK_RECOIL=[28,36,48];"),
    ("const FALLBACK_SEQUENCES=Object.freeze({idle:{folder:'idle',frames:6},run:{folder:'run',frames:6},jump:{folder:'jump',frames:4},attack:{folder:'attack',frames:8},roll:{folder:'dodge',frames:8},hit:{folder:'hurt',frames:7},death:{folder:'death',frames:8}});\n", ""),
    ("function fallbackKey(n,i){return`fallback-${n}-${String(i+1).padStart(2,'0')}`;} function pxKey(a,d,i){return`px-${a}-${d}-${String(i).padStart(3,'0')}`;} function enemyKey(a,d,i){return`enemy1-${a}-${d}-${String(i).padStart(3,'0')}`;}", "function pxKey(a,d,i){return`px-${a}-${d}-${String(i).padStart(3,'0')}`;} function enemyKey(a,d,i){return`enemy1-${a}-${d}-${String(i).padStart(3,'0')}`;}"),
    ("  for(const[n,s]of Object.entries(FALLBACK_SEQUENCES))for(let i=0;i<s.frames;i++){const f=`${s.folder}_${String(i+1).padStart(2,'0')}.png`;this.load.image(fallbackKey(n,i),`${FALLBACK_ASSET_ROOT}/${s.folder}/${f}?v=approved-r2`);}\n", ""),
    ("art=this.add.image(0,27,fallbackKey('idle',0)).setOrigin(.5,1).setScale(ART_SCALE)", "art=this.add.rectangle(0,0,1,1,0xffffff,0)"),
]
for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit(f'Expected cleanup target missing: {old[:100]}')
path.write_text(text)
print('V05 protagonist fallback loading removed.')
