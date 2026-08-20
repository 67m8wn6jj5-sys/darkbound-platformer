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

const {COMBAT_V20,chooseMeleeIntentV20,meleeContactIsValid}=await import('../src/GameSceneV20.js');
const mainSource=readFileSync('src/main.js','utf8');
const v22Source=readFileSync('src/GameSceneV22.js','utf8');
const v21Source=readFileSync('src/GameSceneV21.js','utf8');
assert.match(mainSource,/GameSceneV22/,'main must boot the current environment/combat scene');
assert.match(v22Source,/extends GameSceneV21/,'V22 must preserve V21 combat');
assert.match(v21Source,/extends GameSceneV20/,'V21 must preserve Combat Pass 2 through inheritance');
assert.ok(COMBAT_V20.melee.windupMs>=320,'melee telegraph must be clearly readable');
assert.ok(COMBAT_V20.melee.recoveryMs>=300,'successful evade must create a meaningful punish window');
assert.ok(COMBAT_V20.melee.activeEndMs-COMBAT_V20.melee.activeStartMs<=90,'melee contact must be a short active window');
assert.ok(COMBAT_V20.melee.activeEndMs<COMBAT_V20.melee.lungeMs,'contact window must end before the lunge animation ends');
assert.ok(COMBAT_V20.encounter.enemyAttackSpacingMs>=240,'group attacks must be staggered enough to read');
assert.ok(COMBAT_V20.melee.staggerMs[2]>=350,'heavy combo hit must create a strong stagger');

assert.equal(chooseMeleeIntentV20(150,20,true,true),'windup');
assert.equal(chooseMeleeIntentV20(150,20,true,false),'approach','another committed melee attacker must block a second windup');
assert.equal(chooseMeleeIntentV20(55,20,false,true),'retreat');
assert.equal(chooseMeleeIntentV20(230,20,false,true),'approach');
assert.equal(chooseMeleeIntentV20(110,20,false,true),'hold');
assert.equal(chooseMeleeIntentV20(110,130,true,true),'hold','vertical mismatch must remain safe');
assert.equal(meleeContactIsValid(70,20,100,92),true,'front-side contact in the active window should hit');
assert.equal(meleeContactIsValid(-12,20,100,92),false,'getting behind the attacker must be safe');
assert.equal(meleeContactIsValid(70,20,40,92),false,'windup/early lunge must not damage');
assert.equal(meleeContactIsValid(70,20,190,92),false,'late lunge/recovery must not damage');
assert.equal(meleeContactIsValid(110,20,100,92),false,'outside weapon reach must not damage');
assert.equal(meleeContactIsValid(70,80,100,92),false,'large vertical separation must not damage');

const source=readFileSync('src/GameSceneV20.js','utf8');
assert.match(source,/const relativeX=\(this\.player\.x-enemy\.sprite\.x\)\*enemy\.facing/,'melee hit test must be directional');
assert.match(source,/meleeCommitLockedUntil/,'only one melee enemy should fully commit at a time');
assert.match(source,/createMeleeDangerLane/,'melee windup must visualize the danger lane');
assert.match(source,/damageOverlay/,'player damage needs a strong screen-level cue');
assert.match(source,/`-\$\{hpLost\} HP`/,'player damage needs explicit HP-loss text');
assert.match(source,/pixelArt\.setTintFill\(VFX_WHITE\)/,'player sprite must flash on damage');
assert.match(source,/art\.setTintFill\(VFX_WHITE\)/,'enemies must flash on successful sword contact');
console.log('Combat Fairness & Damage Feedback Pass 2 verification passed.');
