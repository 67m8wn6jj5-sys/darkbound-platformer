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

globalThis.Phaser={Scene:class Scene{},BlendModes:{ADD:'ADD'},Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}}};

const {GameSceneV19,COMBAT_V19,chooseMeleeIntent,chooseTrollIntent}=await import('../src/GameSceneV19.js');
const mainSource=readFileSync('src/main.js','utf8');
const v22Source=readFileSync('src/GameSceneV22.js','utf8');
const v21Source=readFileSync('src/GameSceneV21.js','utf8');
const v20Source=readFileSync('src/GameSceneV20.js','utf8');
assert.match(mainSource,/GameSceneV22/,'main must boot the current environment/combat scene');
assert.match(v22Source,/extends GameSceneV21/,'current scene must preserve V21 combat');
assert.match(v21Source,/extends GameSceneV20/,'V21 must preserve Combat Pass 2');
assert.match(v20Source,/extends GameSceneV19/,'Combat Pass 2 must preserve Pass 1 through inheritance');
assert.ok(COMBAT_V19.melee.windupMs>=260,'melee tell must remain readable');
assert.ok(COMBAT_V19.melee.lungeSpeed>COMBAT_V19.melee.approachSpeedMin,'melee lunge must be a committed burst');
assert.ok(COMBAT_V19.troll.aimMs>=280,'troll throw must have a readable locked aim');
assert.ok(COMBAT_V19.encounter.enemyAttackSpacingMs>=150,'multi-enemy first attacks must be staggered');

assert.equal(chooseMeleeIntent(150,20,true),'windup');
assert.equal(chooseMeleeIntent(55,20,false),'retreat');
assert.equal(chooseMeleeIntent(220,20,false),'approach');
assert.equal(chooseMeleeIntent(105,20,false),'hold');
assert.equal(chooseMeleeIntent(100,150,true),'hold','melee enemy should not attack through a large vertical mismatch');
assert.equal(chooseTrollIntent(220,20,true),'retreat','troll must create space before firing');
assert.equal(chooseTrollIntent(350,20,true),'aim');
assert.equal(chooseTrollIntent(500,20,false),'approach');
assert.equal(chooseTrollIntent(350,20,false),'hold');
assert.equal(chooseTrollIntent(350,260,true),'hold','troll should not fire through a large vertical mismatch');

const s=Object.create(GameSceneV19.prototype);s.dead=false;s.rollEndsAt=1200;
assert.equal(s.isRollInvulnerable(1100),true);assert.equal(s.isRollInvulnerable(1200),false);s.dead=true;assert.equal(s.isRollInvulnerable(1100),false);
const route=Object.create(GameSceneV19.prototype);
assert.equal(route.isBranchDepth(0),true,'room 1 must return to the normal route branch');assert.equal(route.isBranchDepth(1),false);assert.equal(route.isBranchDepth(2),true);assert.equal(route.isBranchDepth(3),false);

const source=readFileSync('src/GameSceneV19.js','utf8');
assert.match(source,/enemy\.attackFacing=dx<0\?-1:1/,'melee attacks must lock facing during telegraph');
assert.match(source,/enemy\.aimTargetX=/,'troll aim must snapshot a target before release');
assert.match(source,/launchLockedTrollRock/,'troll must release toward the locked target');
assert.match(source,/progressionGates\?\.values/,'projectiles must collide with active arena gates');
assert.match(source,/showDodgeFeedback/,'successful roll evasion needs explicit feedback');
assert.match(source,/spawnContactSlash/,'successful sword contact needs a dedicated contact accent');
console.log('Combat Feel & Enemy Intelligence Pass 1 verification passed.');
