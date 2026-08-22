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

const {
  LONG_STAGE_V33,
  AUTHORED_TRAVERSAL_V33,
  generateLongTraversalV33,
  GameSceneV33,
}=await import('../src/GameSceneV33.js');

assert.ok(GameSceneV33.prototype.rebuildRoomLayout,'V33 must own the live long-level rebuild');
assert.ok(LONG_STAGE_V33.right-LONG_STAGE_V33.left>=8000,'V33 traversal must span at least 8k pixels');
assert.ok(LONG_STAGE_V33.worldWidth>LONG_STAGE_V33.right,'camera/physics world must extend beyond the authored floor');
assert.equal(AUTHORED_TRAVERSAL_V33.sections.length,7,'V33 needs seven authored traversal sections');
assert.equal(AUTHORED_TRAVERSAL_V33.lights.length,8,'V33 should keep sparse candle landmarks only');
assert.ok(AUTHORED_TRAVERSAL_V33.platforms.length>=20,'V33 needs enough authored surfaces for meaningful traversal variety');

const room=generateLongTraversalV33(42,0,'duel');
assert.equal(room.grammar,'longTraversal');
assert.equal(room.floorSegments.length,1,'V33 must not visually suggest pits that are secretly solid');
assert.deepEqual(room.floorSegments[0],room.floor,'floor rendering and floor collision must share the exact same rectangle');
assert.equal(room.floor.x,LONG_STAGE_V33.left);
assert.equal(room.floor.x+room.floor.w,LONG_STAGE_V33.right);
assert.equal(room.collision.length,room.platforms.length+1);
assert.equal(room.groundSpawns.length,6);
assert.equal(room.perchSpawns.length,6);

for(const section of room.sections){
  assert.ok(section.end>section.start,`${section.id} section must have positive traversal width`);
}
for(let i=1;i<room.sections.length;i++){
  assert.equal(room.sections[i-1].end,room.sections[i].start,'V33 authored sections must meet cleanly with no phantom gaps');
}
for(const spec of room.platforms){
  assert.equal(spec.x%32,0,'platform x must remain on the PixelLab tile grid');
  assert.equal(spec.y%32,0,'platform y must remain on the PixelLab tile grid');
  assert.equal(spec.w%32,0,'platform width must remain on the PixelLab tile grid');
  assert.ok(spec.x>=LONG_STAGE_V33.left&&spec.x+spec.w<=LONG_STAGE_V33.right,'platform must remain inside the long traversal world');
}

const source=readFileSync('src/GameSceneV33.js','utf8');
assert.match(source,/extends GameSceneV32/,'V33 must preserve the V32/V29 combat inheritance chain');
assert.match(source,/drawBackground\(\)[\s\S]*setBackgroundColor\('#070910'\)/,'V33 must suppress the rejected masonry/background treatment');
assert.match(source,/renderSolidFloorV33/,'V33 must explicitly render the solid floor from its collision rectangle');
assert.match(source,/renderGothicTerrain\(layout\.platforms\)/,'platform art must be generated from the exact platform collision list');
assert.match(source,/replaceStageGatesV24\(isBoss=false\)/,'V33 must own normal-room gate replacement');
assert.match(source,/this\.clearV28Gates\(\)/,'normal traversal must explicitly clear old invisible gate blockers');
assert.match(source,/v24OuterGateXs=\[\]/,'normal traversal must have no outer arena gates');
assert.match(source,/activationDistancePx/,'V33 enemy activation must be proximity-based');
assert.match(source,/setEnemyDormant\(enemy,true\)/,'far-away enemies must begin dormant');
assert.match(source,/dressLongTraversalV33/,'V33 should retain sparse authored light landmarks');
assert.doesNotMatch(source,/dressAuthoredWorldV32\(|addContinuousBackgroundV32\(|renderArchitectureV32\(/,'V33 must not render the rejected V32 background/arch composition');
assert.doesNotMatch(source,/ENVIRONMENT_ART_V30\.arches|ENVIRONMENT_ART_V30\.backgroundObjects/,'V33 must not stamp arch or background-object exports into the traversal stage');

const main=readFileSync('src/main.js','utf8');
assert.match(main,/import \{ GameSceneV33 \} from '\.\/GameSceneV33\.js'/);
assert.match(main,/scene: \[GameSceneV33\]/);
assert.match(main,/GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29/);

console.log('V33 long traversal, honest floor, open-gate, sparse-art verification passed.');
