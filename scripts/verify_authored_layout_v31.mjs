import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const temporaryManifests=[['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {};\n'],['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {};\n'],['src/boss1Manifest.js','export const BOSS1_MANIFEST = {};\n']];
const created=[];for(const [path,source] of temporaryManifests){if(!existsSync(path)){writeFileSync(path,source);created.push(path);}}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});
globalThis.Phaser={Scene:class Scene{},BlendModes:{ADD:'ADD'},Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}}};
const {AUTHORED_STAGE_V31,chooseAuthoredLayoutV31,generateAuthoredStageV31,GameSceneV31}=await import('../src/GameSceneV31.js');
assert.deepEqual(Object.keys(AUTHORED_STAGE_V31),['grandNave','cryptStair','ruinedGallery','choirLoft']);
assert.ok(GameSceneV31.prototype.rebuildRoomLayout);
for(const [id,authored] of Object.entries(AUTHORED_STAGE_V31)){
  assert.ok(authored.platforms.length>=5&&authored.platforms.length<=7);
  const route=authored.platforms.filter(spec=>spec.role==='route').sort((a,b)=>a.x-b.x);
  assert.ok(route.length>=4);
  for(const spec of authored.platforms){assert.equal(spec.x%32,0);assert.equal(spec.y%32,0);assert.equal(spec.w%32,0);assert.ok(spec.w>=192);}
  for(let index=1;index<route.length;index++){
    const previous=route[index-1],current=route[index];
    const gap=Math.max(0,current.x-(previous.x+previous.w));
    assert.ok(gap<=128,`${id} historical route gap drifted`);
    assert.ok(Math.abs(current.y-previous.y)<=64,`${id} historical rise drifted`);
  }
}
for(const template of ['duel','hunters','mixed','crossfire','pressure','barrage','elite']){
  for(let seed=1;seed<=20;seed++){
    const id=chooseAuthoredLayoutV31(seed,seed%4,template);assert.ok(AUTHORED_STAGE_V31[id]);
    const room=generateAuthoredStageV31(seed,seed%4,template);
    assert.equal(room.floor.x,256);assert.equal(room.floor.y,640);assert.equal(room.floor.w,2304);assert.equal(room.floor.h,96);
    assert.equal(room.floorSegments.length,1);assert.equal(room.collision.length,room.platforms.length+1);
  }
}
assert.deepEqual(generateAuthoredStageV31(9512,0,'duel'),generateAuthoredStageV31(9512,0,'duel'));
const source=readFileSync('src/GameSceneV31.js','utf8');
assert.doesNotMatch(source,/generateModularStageV28|dressModularWorldV28\(|randInt|jitterStagePlatforms|floorSegmentsForChunk|platformFromLocal/);
const v30=readFileSync('src/GameSceneV30.js','utf8');
assert.match(v30,/pixellab-tileset-ancient-dark-gothic-stone-masonry-large-a89e3ba5\.png/);assert.doesNotMatch(v30,/606f17e2|e686e8eb/);
const main=readFileSync('src/main.js','utf8');const v33=readFileSync('src/GameSceneV33.js','utf8');const v32=readFileSync('src/GameSceneV32.js','utf8');
assert.match(main,/import \{ GameSceneV33 \} from '\.\/GameSceneV33\.js'/);assert.match(main,/scene: \[GameSceneV33\]/);
assert.match(v33,/extends GameSceneV32/);assert.match(v32,/extends GameSceneV31/);
console.log('Historical V31 authored-layout verification passed beneath V33.');
