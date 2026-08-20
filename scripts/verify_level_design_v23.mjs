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
  GameSceneV23,
  LEVEL_DESIGN_V23,
  generatePlayableRoomV23,
  reachablePlatformCount,
  roomHasBaselineTraversal,
}=await import('../src/GameSceneV23.js');
const {GameSceneV22,GOTHIC_TILE_SIZE,ARENA_GRID_LEFT,ARENA_GRID_RIGHT,ARENA_FLOOR_Y}=await import('../src/GameSceneV22.js');

assert.match(readFileSync('src/main.js','utf8'),/GameSceneV23/,'main must boot the playable level design scene');
assert.ok(GameSceneV23.prototype instanceof GameSceneV22,'V23 must preserve V22 terrain and V21 combat through inheritance');
assert.equal(LEVEL_DESIGN_V23.maxBaselineRisePx,96,'baseline route must respect the current single-jump vertical budget');
assert.ok(LEVEL_DESIGN_V23.maxHorizontalJumpGapPx<=160,'baseline gaps must stay conservative for combat movement');
assert.ok(LEVEL_DESIGN_V23.oneWayColliderHeightPx<=12,'raised-platform collision should remain a thin landing surface');
assert.ok(LEVEL_DESIGN_V23.entrySafeUntilX>=800,'enemy anchors must leave a meaningful player-entry safe zone');

const templates=['duel','hunters','mixed','crossfire','pressure','barrage','elite'];
const seeds=[1,2,7,42,99,31337,999999,123456789,0xffffffff];
for(const seed of seeds){
  for(let depth=0;depth<5;depth++){
    for(const template of templates){
      const room=generatePlayableRoomV23(seed,depth,template);
      const repeat=generatePlayableRoomV23(seed,depth,template);
      assert.deepEqual(room,repeat,'V23 geometry must remain reproducible from seed/depth/encounter');
      assert.equal(room.floor.x,ARENA_GRID_LEFT);
      assert.equal(room.floor.x+room.floor.w,ARENA_GRID_RIGHT);
      assert.equal(room.floor.y,ARENA_FLOOR_Y);
      assert.ok(room.platforms.length>=3&&room.platforms.length<=5,'rooms need enough structure without becoming cluttered');
      assert.equal(reachablePlatformCount(room),room.platforms.length,'every generated platform must be reachable with baseline movement');
      assert.equal(roomHasBaselineTraversal(room),true,'every generated room must pass the baseline traversal graph');
      assert.ok(room.groundSpawns.length>=3,'rooms need several separated ground combat anchors');
      assert.ok(room.groundSpawns.every(spawn=>spawn.x>=LEVEL_DESIGN_V23.entrySafeUntilX),'ground enemies must stay outside the entry safe zone');
      assert.ok(room.groundSpawns.every(spawn=>Math.abs(spawn.x-room.player.x)>=LEVEL_DESIGN_V23.enemyMinPlayerDistancePx),'ground enemies must not spawn on top of the player');

      for(const spec of [room.floor,...room.platforms]){
        assert.equal(spec.x%GOTHIC_TILE_SIZE,0);
        assert.equal(spec.y%GOTHIC_TILE_SIZE,0);
        assert.equal(spec.w%GOTHIC_TILE_SIZE,0);
      }
      for(let i=0;i<room.groundSpawns.length;i++){
        for(let j=i+1;j<room.groundSpawns.length;j++){
          assert.ok(Math.abs(room.groundSpawns[i].x-room.groundSpawns[j].x)>=160,'ground combat anchors must not stack enemies together');
        }
      }
    }
  }
}

const crossfire=generatePlayableRoomV23(42,2,'crossfire');
assert.ok(['perchRun','splitRoute'].includes(crossfire.grammar),'ranged-heavy crossfire encounters should use a vertical/perch-friendly grammar');
assert.ok(crossfire.perchSpawns.length>=2,'crossfire rooms should expose multiple useful ranged perches');
const hunters=generatePlayableRoomV23(42,2,'hunters');
assert.ok(['stairLoop','zigzag','duelRun'].includes(hunters.grammar),'melee-heavy hunter rooms should use chase-friendly geometry');

const fake=Object.create(GameSceneV23.prototype);
const collider={body:{checkCollision:{up:true,down:true,left:true,right:true}}};
fake.configureOneWayPlatform(collider);
assert.equal(collider.body.checkCollision.up,true,'raised platform must still catch downward landings');
assert.equal(collider.body.checkCollision.down,false,'player/enemies must be able to jump through raised terrain from below');
assert.equal(collider.body.checkCollision.left,false,'raised terrain must not act like an accidental side wall');
assert.equal(collider.body.checkCollision.right,false,'raised terrain must not act like an accidental side wall');

const source=readFileSync('src/GameSceneV23.js','utf8');
assert.match(source,/check\.down=false/,'one-way traversal must disable underside collision');
assert.match(source,/check\.left=false/,'one-way traversal must disable left-side collision');
assert.match(source,/check\.right=false/,'one-way traversal must disable right-side collision');
assert.match(source,/renderGothicTerrain\(\[layout\.floor,\.\.\.layout\.platforms\]\)/,'visual 32px terrain must remain separate from thin traversal colliders');
assert.match(source,/enemyMinPlayerDistancePx:288/,'combat spawning must reserve player breathing room');
assert.match(source,/TEMPLATE_ARCHETYPES/,'encounter composition must influence room shape');
assert.match(source,/FLOW OK/,'vertical-slice debug readout should expose successful flow generation during playtesting');

console.log('Playable Procedural Level Design V23 verification passed.');
