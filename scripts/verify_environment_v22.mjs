import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests=[
  ['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {patrol:{east:1,west:1},lunge:{east:8,west:8},hit:{east:8,west:8},death:{east:8,west:8}};\n'],
  ['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {patrol:{east:1,west:1},attack:{east:9,west:9},hit:{east:8,west:8},death:{east:8,west:8},rock:"rock/rock.png"};\n'],
  ['src/boss1Manifest.js','export const BOSS1_MANIFEST = {idle:{east:1,west:1},lunge:{east:9,west:9},slam:{east:9,west:9},hit:{east:8,west:8},death:{east:8,west:8}};\n'],
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
  GameSceneV22,
  GOTHIC_TILE_SIZE,
  GOTHIC_TILESET_PATH,
  ARENA_GRID_LEFT,
  ARENA_GRID_RIGHT,
  ARENA_FLOOR_Y,
  PIXELLAB_MASK_ORDER,
  PIXELLAB_FRAME_BY_MASK,
  generateProceduralRoom,
  frameForTerrainMask,
  parseEnvironmentSeed,
}=await import('../src/GameSceneV22.js');

assert.match(readFileSync('src/main.js','utf8'),/GameSceneV22/,'main must boot the procedural gothic environment scene');
assert.ok(GameSceneV22.prototype instanceof (await import('../src/GameSceneV21.js')).GameSceneV21,'V22 must preserve V21 combat through inheritance');

const assetPath='pixellab-tileset-ancient-dark-gothic-stone-masonry-large-a89e3ba5.png';
assert.ok(existsSync(assetPath),'uploaded PixelLab terrain sheet must remain present');
const png=readFileSync(assetPath);
assert.equal(png.readUInt32BE(16),128,'PixelLab terrain sheet width must remain 128px');
assert.equal(png.readUInt32BE(20),128,'PixelLab terrain sheet height must remain 128px');
assert.equal(GOTHIC_TILE_SIZE,32,'terrain cells must remain 32px');
assert.match(GOTHIC_TILESET_PATH,/pixellab-tileset-ancient-dark-gothic-stone-masonry-large-a89e3ba5\.png/,'V22 must load the uploaded PixelLab sheet');

assert.deepEqual(PIXELLAB_MASK_ORDER,[13,10,4,12,6,8,0,1,11,3,2,5,15,14,9,7]);
assert.equal(new Set(PIXELLAB_FRAME_BY_MASK).size,16,'all 16 corner masks must map to unique atlas frames');
for(let mask=0;mask<16;mask++)assert.equal(PIXELLAB_MASK_ORDER[frameForTerrainMask(mask)],mask,`mask ${mask} must resolve to its correct PixelLab frame`);

const first=generateProceduralRoom(123456789,2,'mixed');
const repeat=generateProceduralRoom(123456789,2,'mixed');
assert.deepEqual(first,repeat,'same run seed, depth, and room type must reproduce identical geometry');
assert.notEqual(generateProceduralRoom(123456790,2,'mixed').roomSeed,first.roomSeed,'different seeds must produce a different room seed');
assert.notEqual(generateProceduralRoom(123456789,3,'mixed').roomSeed,first.roomSeed,'room depth must participate in the room seed');
assert.notEqual(generateProceduralRoom(123456789,2,'hunters').roomSeed,first.roomSeed,'encounter type must participate in the room seed');

for(const seed of [1,2,7,42,999,123456789,0xffffffff]){
  for(let depth=0;depth<5;depth++){
    const room=generateProceduralRoom(seed,depth,depth===0?'duel':'pressure');
    assert.equal(room.floor.x,ARENA_GRID_LEFT);
    assert.equal(room.floor.x+room.floor.w,ARENA_GRID_RIGHT,'floor must span the full playable arena');
    assert.equal(room.floor.y,ARENA_FLOOR_Y);
    assert.equal(room.floor.h,96,'floor must have enough visual/collision depth for the DualGrid renderer');
    assert.ok(room.platforms.length>=3&&room.platforms.length<=4,'room grammar should create a controlled platform count');
    assert.ok(room.player.x>=ARENA_GRID_LEFT+64&&room.player.x<=ARENA_GRID_RIGHT-64,'player spawn must be inside the playable arena');
    assert.ok(room.groundSpawns.length>=3,'every room must expose several safe ground spawn anchors');
    assert.equal(room.perchSpawns.length,room.platforms.length,'each raised platform should provide an elevated spawn anchor');

    for(const spec of room.collision){
      assert.equal(spec.x%GOTHIC_TILE_SIZE,0,'collision x must align to the 32px terrain grid');
      assert.equal(spec.y%GOTHIC_TILE_SIZE,0,'collision y must align to the 32px terrain grid');
      assert.equal(spec.w%GOTHIC_TILE_SIZE,0,'collision width must align to the 32px terrain grid');
      assert.equal(spec.h%GOTHIC_TILE_SIZE,0,'collision height must align to the 32px terrain grid');
    }
    for(const spec of room.platforms){
      assert.ok(spec.x>=ARENA_GRID_LEFT+128,'raised platforms must leave the player-entry side readable');
      assert.ok(spec.x+spec.w<=ARENA_GRID_RIGHT-64,'raised platforms must stay inside the arena');
      assert.ok(spec.y>=352&&spec.y<=544,'raised platforms must stay within the validated combat/jump band');
      assert.ok(spec.w>=160&&spec.w<=256,'raised platforms must remain large enough for combat footing');
    }
    for(const spawn of [...room.groundSpawns,...room.perchSpawns]){
      assert.ok(spawn.x>ARENA_GRID_LEFT&&spawn.x<ARENA_GRID_RIGHT,'enemy spawn anchors must remain inside the arena');
      assert.ok(spawn.y<ARENA_FLOOR_Y,'enemy spawn anchors must start above the floor collision');
    }
  }
}

assert.equal(parseEnvironmentSeed('42'),42);
assert.equal(parseEnvironmentSeed('4294967297'),1,'seed parsing should normalize to unsigned 32-bit values');
assert.equal(parseEnvironmentSeed(''),null);
assert.equal(parseEnvironmentSeed('not-a-number'),null);

const source=readFileSync('src/GameSceneV22.js','utf8');
assert.match(source,/load\.spritesheet\(GOTHIC_TILESET_KEY,GOTHIC_TILESET_PATH,\{frameWidth:GOTHIC_TILE_SIZE,frameHeight:GOTHIC_TILE_SIZE\}\)/,'PixelLab sheet must load as a 32x32 spritesheet');
assert.match(source,/const mask=\(has\(vx-1,vy-1\)\?0:8\)/,'renderer must derive DualGrid tiles from neighboring solid occupancy');
assert.match(source,/if\(mask===15\)continue/,'fully empty DualGrid cells must not render terrain');
assert.match(source,/clearEnvironmentGeometry/,'each generated room must replace the prior collision/art geometry');
assert.match(source,/enemy\.type==='enemy2'/,'ranged enemies should prefer elevated procedural spawn anchors');
assert.match(source,/new URLSearchParams\(search\)\.get\('seed'\)/,'seed query parameter must support reproduction of bad generations');
assert.match(source,/SEED \$\{this\.runSeed>>>0\}/,'the active seed must be visible during the vertical-slice test');

console.log('Procedural Gothic Ruins V22 environment verification passed.');
