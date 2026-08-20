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
  GameSceneV24,
  STAGE_FLOW_V24,
  generateExpandedStageV24,
  expandedEnemyRosterV24,
  activationZoneForX,
}=await import('../src/GameSceneV24.js');
const {GameSceneV23,roomHasBaselineTraversal}=await import('../src/GameSceneV23.js');

const main=readFileSync('src/main.js','utf8');
assert.match(main,/GameSceneV24/,'main must boot Expanded Stage Flow V24');
assert.ok(GameSceneV24.prototype instanceof GameSceneV23,'V24 must preserve V23 level design and all inherited combat');
assert.ok(STAGE_FLOW_V24.right-STAGE_FLOW_V24.left>=STAGE_FLOW_V24.minStageWidthPx,'stage must span substantially more than one screen');
assert.equal(STAGE_FLOW_V24.stageZones,3,'expanded stage must have three progression zones');
assert.equal(STAGE_FLOW_V24.activationThresholds.length,3);
assert.ok(STAGE_FLOW_V24.activationThresholds[1]>STAGE_FLOW_V24.playerStartX+500,'second combat zone must require meaningful travel');
assert.ok(STAGE_FLOW_V24.activationThresholds[2]>STAGE_FLOW_V24.activationThresholds[1]+500,'third combat zone must be spatially distinct');

const templateIds=['duel','hunters','mixed','crossfire','pressure','barrage','elite'];
for(const seed of [1,2,7,42,999,123456789,0xffffffff]){
  for(const templateId of templateIds){
    for(let depth=0;depth<5;depth++){
      const room=generateExpandedStageV24(seed,depth,templateId);
      assert.equal(room.floor.x,STAGE_FLOW_V24.left);
      assert.equal(room.floor.x+room.floor.w,STAGE_FLOW_V24.right);
      assert.ok(room.floor.w>=STAGE_FLOW_V24.minStageWidthPx,'expanded floor must stay wider than the V23 arena');
      assert.ok(room.platforms.length>=STAGE_FLOW_V24.minPlatforms,'stage must provide enough traversal structure to feel like a level');
      assert.ok(roomHasBaselineTraversal(room),`stage must remain baseline-reachable: seed ${seed}, ${templateId}, depth ${depth}`);
      assert.ok(room.groundSpawns.length>=8,'expanded stage must expose many separated ground anchors');
      assert.ok(room.perchSpawns.length>=3,'expanded stage must expose multiple raised combat anchors');
      assert.ok(room.player.x<room.groundSpawns[0].x,'player must enter before the first enemy lane');
      for(const spec of room.platforms){
        assert.ok(spec.x>STAGE_FLOW_V24.left,'platforms must remain inside the stage');
        assert.ok(spec.x+spec.w<STAGE_FLOW_V24.right,'platforms must leave room near the exit gate');
      }
    }
  }
}

assert.deepEqual(expandedEnemyRosterV24('duel',0),['enemy1','enemy1','enemy1']);
assert.equal(expandedEnemyRosterV24('hunters',0).length,4);
assert.equal(expandedEnemyRosterV24('mixed',2).length,5);
assert.equal(expandedEnemyRosterV24('pressure',3).length,6);
assert.equal(expandedEnemyRosterV24('elite',4).length,6);
for(const templateId of templateIds){
  const roster=expandedEnemyRosterV24(templateId,4);
  assert.ok(roster.length>=3&&roster.length<=6,'expanded combat groups must stay within the validated 3-6 enemy band');
}

assert.equal(activationZoneForX(700),0);
assert.equal(activationZoneForX(1200),1);
assert.equal(activationZoneForX(2100),2);

const source=readFileSync('src/GameSceneV24.js','utf8');
assert.match(source,/setEnemyDormant\(enemy,true\)/,'later-zone enemies must stay dormant until the player reaches them');
assert.match(source,/playerX>=enemy\.v24ActivationX-32/,'enemy activation must depend on spatial progress through the level');
assert.match(source,/expandedEnemyRosterV24\(template\.id,depth\)/,'room templates must be expanded beyond the old 1-3 enemy encounters');
assert.match(source,/STAGE_FLOW_V24\.right/,'expanded stage must use the wider right boundary');
assert.match(source,/for\(const spec of layout\.platforms\)this\.addTraversalCollider\(spec\)/,'raised terrain must preserve V23 one-way traversal');
assert.match(source,/template\?\.id==='boss1'/,'boss arena must remain explicitly authored rather than stretched blindly');
assert.match(source,/replaceStageGatesV24/,'progression gates must move with the expanded stage');

console.log('Expanded Stage Flow V24 verification passed.');
