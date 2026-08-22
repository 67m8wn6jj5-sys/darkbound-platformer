import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests=[
  ['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {};\n'],
  ['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {};\n'],
  ['src/boss1Manifest.js','export const BOSS1_MANIFEST = {};\n'],
];
const created=[];
for(const [path,source] of temporaryManifests){if(!existsSync(path)){writeFileSync(path,source);created.push(path);}}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});

globalThis.Phaser={
  Scene:class Scene{},
  BlendModes:{ADD:'ADD'},
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {AUTHORED_DRESSING_V32,GameSceneV32}=await import('../src/GameSceneV32.js');
const {generateAuthoredStageV31}=await import('../src/GameSceneV31.js');
const {ENVIRONMENT_ART_V30}=await import('../src/GameSceneV30.js');

assert.deepEqual(Object.keys(AUTHORED_DRESSING_V32),['grandNave','cryptStair','ruinedGallery','choirLoft']);
assert.ok(GameSceneV32.prototype.rebuildRoomLayout,'V32 must own the live room rebuild so it can dress the authored V31 geometry');

const objectIndexes=[];
const archIndexes=[];
const lightIndexes=[];
for(const [roomId,dressing] of Object.entries(AUTHORED_DRESSING_V32)){
  assert.ok(dressing.architecture.length>=3&&dressing.architecture.length<=4,`${roomId} needs a restrained architectural rhythm`);
  assert.equal(dressing.objects.length,3,`${roomId} should use exactly three small background-object slots`);
  assert.ok(dressing.arches.length>=1&&dressing.arches.length<=2,`${roomId} should use only one or two arch-object focal points`);
  assert.equal(dressing.lights.length,2,`${roomId} should use two authored candle/light points`);

  for(const spec of dressing.architecture){
    assert.equal(spec.x%32,0,`${roomId} architecture x must stay on grid`);
    assert.equal(spec.y%32,0,`${roomId} architecture y must stay on grid`);
    assert.equal(spec.w%32,0,`${roomId} architecture width must stay on grid`);
    assert.equal(spec.h%32,0,`${roomId} architecture height must stay on grid`);
    assert.ok(spec.w<=64,`${roomId} supports should stay narrow and subordinate to gameplay terrain`);
  }
  for(const slot of dressing.objects){
    objectIndexes.push(slot.asset);
    assert.ok(slot.scale<=1.10,`${roomId} background objects must not return to oversized V30 stamping`);
    assert.ok(slot.alpha<=.68,`${roomId} background objects must remain visually subordinate`);
  }
  for(const slot of dressing.arches){
    archIndexes.push(slot.asset);
    assert.ok(slot.scale<=2.50,`${roomId} arch objects must stay below the old oversized V30 scale`);
    assert.ok(slot.alpha<=.46,`${roomId} arches must remain in the background hierarchy`);
  }
  for(const slot of dressing.lights)lightIndexes.push(slot.asset);
}

assert.deepEqual([...new Set(objectIndexes)].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9,10,11],'all 12 uploaded background-object variants must have an authored home');
assert.deepEqual([...new Set(archIndexes)].sort((a,b)=>a-b),[0,1,2,3,4],'all five uploaded arch variants must have an authored home');
assert.deepEqual([...new Set(lightIndexes)].sort((a,b)=>a-b),[0,1,2],'all three uploaded candle/light variants must have an authored home');
assert.equal(ENVIRONMENT_ART_V30.backgroundObjects.length,12);
assert.equal(ENVIRONMENT_ART_V30.arches.length,5);
assert.equal(ENVIRONMENT_ART_V30.lights.length,3);

for(const roomId of Object.keys(AUTHORED_DRESSING_V32)){
  let found=false;
  for(const template of ['duel','hunters','mixed','crossfire','pressure','barrage','elite']){
    for(let seed=1;seed<=80&&!found;seed++){
      if(generateAuthoredStageV31(seed,seed%4,template).grammar===roomId)found=true;
    }
  }
  assert.ok(found,`${roomId} must remain reachable through V31 room selection`);
}

const source=readFileSync('src/GameSceneV32.js','utf8');
assert.match(source,/extends GameSceneV31/,'V32 must preserve V31 authored traversal');
assert.match(source,/ENVIRONMENT_ART_V30\.background\.key/,'V32 must use the recessed masonry tileset as the rear wall');
assert.match(source,/ENVIRONMENT_ART_V30\.architecture\.key/,'V32 must use the pillar\/arch tileset for non-collision architecture');
assert.match(source,/renderGothicTerrain\(layout\.collision\)/,'V32 must retain the original approved foreground terrain through V30 rendering');
assert.match(source,/addAuthoredLightV32/,'PixelLab candle/light assets must be visible again');
assert.match(source,/ENVIRONMENT_ART_V30\.backgroundObjects/,'uploaded background objects must be visible again');
assert.match(source,/ENVIRONMENT_ART_V30\.arches/,'uploaded arch objects must be visible again');
assert.doesNotMatch(source,/variantIndex|Math\.random|randInt|jitter/,'V32 dressing must not randomly place or select room art');
assert.doesNotMatch(source,/dressModularWorldV28\(|dressAuthoredWorldV31\(/,'V32 must not fall back to older random or empty dressing passes');

const v30=readFileSync('src/GameSceneV30.js','utf8');
assert.match(v30,/pixellab-tileset-ancient-dark-gothic-stone-masonry-large-a89e3ba5\.png/,'foreground must remain the original approved tileset');
assert.match(v30,/pixellab-tileset-ancient-recessed-gothic-dungeon-wall-masonry-965b1f4b\.png/,'second tileset must remain available for the background wall');
assert.match(v30,/pixellab-tileset-ancient-gothic-stone-pillar-and-arch-masonry-919c3a88\.png/,'third tileset must remain available for architecture');
assert.doesNotMatch(v30,/606f17e2|e686e8eb/,'both rejected platform tilesets must remain absent');

const main=readFileSync('src/main.js','utf8');
assert.match(main,/import \{ GameSceneV32 \} from '\.\/GameSceneV32\.js'/);
assert.match(main,/scene: \[GameSceneV32\]/);
assert.match(main,/GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29/);

console.log('V32 authored three-tileset environment dressing verification passed.');
