import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const temporaryManifests=[['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {};\n'],['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {};\n'],['src/boss1Manifest.js','export const BOSS1_MANIFEST = {};\n']];
const created=[];for(const [path,source] of temporaryManifests){if(!existsSync(path)){writeFileSync(path,source);created.push(path);}}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});
globalThis.Phaser={Scene:class Scene{},BlendModes:{ADD:'ADD'},Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}}};
const {AUTHORED_DRESSING_V32,GameSceneV32}=await import('../src/GameSceneV32.js');
const {ENVIRONMENT_ART_V30}=await import('../src/GameSceneV30.js');
assert.deepEqual(Object.keys(AUTHORED_DRESSING_V32),['grandNave','cryptStair','ruinedGallery','choirLoft']);
assert.ok(GameSceneV32.prototype.rebuildRoomLayout);
const objectIndexes=[],archIndexes=[],lightIndexes=[];
for(const [roomId,dressing] of Object.entries(AUTHORED_DRESSING_V32)){
  assert.ok(dressing.architecture.length>=3&&dressing.architecture.length<=4);
  assert.equal(dressing.objects.length,3);assert.ok(dressing.arches.length>=1&&dressing.arches.length<=2);assert.equal(dressing.lights.length,2);
  for(const slot of dressing.objects){objectIndexes.push(slot.asset);assert.ok(slot.scale<=1.10);assert.ok(slot.alpha<=.68);}
  for(const slot of dressing.arches){archIndexes.push(slot.asset);assert.ok(slot.scale<=2.50);assert.ok(slot.alpha<=.46);}
  for(const slot of dressing.lights)lightIndexes.push(slot.asset);
  for(const spec of dressing.architecture){assert.equal(spec.x%32,0,roomId);assert.equal(spec.y%32,0,roomId);}
}
assert.deepEqual([...new Set(objectIndexes)].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9,10,11]);
assert.deepEqual([...new Set(archIndexes)].sort((a,b)=>a-b),[0,1,2,3,4]);
assert.deepEqual([...new Set(lightIndexes)].sort((a,b)=>a-b),[0,1,2]);
assert.equal(ENVIRONMENT_ART_V30.backgroundObjects.length,12);assert.equal(ENVIRONMENT_ART_V30.arches.length,5);assert.equal(ENVIRONMENT_ART_V30.lights.length,3);
const source=readFileSync('src/GameSceneV32.js','utf8');
assert.match(source,/extends GameSceneV31/);assert.match(source,/ENVIRONMENT_ART_V30\.background\.key/);assert.match(source,/ENVIRONMENT_ART_V30\.architecture\.key/);assert.match(source,/addAuthoredLightV32/);assert.match(source,/ENVIRONMENT_ART_V30\.backgroundObjects/);assert.match(source,/ENVIRONMENT_ART_V30\.arches/);
assert.doesNotMatch(source,/variantIndex\(|Math\.random\(|randInt\(|jitterStagePlatforms\(|floorSegmentsForChunk\(|platformFromLocal\(/);
const v30=readFileSync('src/GameSceneV30.js','utf8');assert.match(v30,/pixellab-tileset-ancient-dark-gothic-stone-masonry-large-a89e3ba5\.png/);assert.doesNotMatch(v30,/606f17e2|e686e8eb/);
const main=readFileSync('src/main.js','utf8');const v34=readFileSync('src/GameSceneV34.js','utf8');const v33=readFileSync('src/GameSceneV33.js','utf8');
assert.match(main,/import \{ GameSceneV34 \} from '\.\/GameSceneV34\.js'/);assert.match(main,/scene: \[GameSceneV34\]/);assert.match(v34,/extends GameSceneV33/);assert.match(v33,/extends GameSceneV32/);
assert.doesNotMatch(v33,/dressAuthoredWorldV32\(|addContinuousBackgroundV32\(|renderArchitectureV32\(/,'V33 intentionally retired the rejected V32 composition');
assert.doesNotMatch(v34,/ENVIRONMENT_ART_V30\.arches/,'V34 must not revive the incomplete V32 arch-object presentation');
console.log('Historical V32 asset/dressing verification passed beneath V34.');
