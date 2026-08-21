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

globalThis.Phaser={Scene:class Scene{}};
const {GameSceneV17}=await import('../src/GameSceneV17.js');
const {PIXELLAB_MANIFEST}=await import('../src/pixellabManifest.js');

const TODAY_SWORD='Recreate_this_character-Sword_attack.zip';
const TODAY_KO='Recreate_this_character-Ko_Gasumi_sword_atta.zip';

function scene(overrides={}){
  const s=Object.create(GameSceneV17.prototype);
  Object.assign(s,{
    dead:false,
    hitAnimEndsAt:-Infinity,
    hitAnimStartsAt:-Infinity,
    deathAnimStartsAt:-Infinity,
    state:'idle',
    comboStep:0,
    facing:1,
    attackStartsAt:1000,
    attackEndsAt:1230,
    attackQueued:false,
    queuedAttackCount:0,
    lastRollAt:1000,
    landingStartedAt:-Infinity,
    landingEndsAt:-Infinity,
    pixelStateStartedAt:1000,
    visualDirection:'east',
    turnTargetDirection:'east',
    turning:false,
    nextTurnStepAt:0,
    player:{body:{blocked:{down:true},velocity:{x:0,y:0}}},
  },overrides);
  return s;
}

function state(name,mutator,expected,time=1200){
  const s=scene();
  mutator(s);
  assert.equal(s.resolvePixelState(time),expected,name);
}

assert.match(readFileSync('src/GameSceneV17.js','utf8'),/const ART_SCALE=\.396;/);

assert.equal(PIXELLAB_MANIFEST.attack_1.sourceArchive,TODAY_KO);
assert.equal(PIXELLAB_MANIFEST.attack_2.sourceArchive,TODAY_SWORD);
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceArchive,TODAY_SWORD);
assert.equal(PIXELLAB_MANIFEST.attack_1.sourceAnimation,'The_warrior_shifts_his_weight_forward_tightening_h');
assert.equal(PIXELLAB_MANIFEST.attack_2.sourceAnimation,'Upward_sword_slash._Starting_from_the_feet_and_fin');
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceAnimation,'The_warrior_shifts_his_weight_forward_tightening_h');
assert.equal(PIXELLAB_MANIFEST.attack_1.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_1.west,8);
assert.equal(PIXELLAB_MANIFEST.attack_2.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_3.east,9);
assert.equal(PIXELLAB_MANIFEST.attack_3.west,9);
assert.ok(!('attack_alt' in PIXELLAB_MANIFEST));
for(const action of ['attack_1','attack_2','attack_3']){
  assert.equal(PIXELLAB_MANIFEST[action].rotationArchive,'Sprite updates protagonist .zip');
}
for(const action of ['idle','run','jump','fall','land','dash','hit','death']){
  assert.equal(PIXELLAB_MANIFEST[action].sourceArchive,'Sprite updates protagonist .zip');
}

{
  const s=scene();
  assert.equal(s.attackActionForStep(0),'attack_1');
  assert.equal(s.attackActionForStep(1),'attack_2');
  assert.equal(s.attackActionForStep(2),'attack_3');
}

state('idle',()=>{},'idle');
state('run',s=>{s.state='running';s.player.body.velocity.x=285;},'run');
state('jump',s=>{s.state='rising';s.player.body.blocked.down=false;s.player.body.velocity.y=-300;},'jump');
state('fall',s=>{s.state='falling';s.player.body.blocked.down=false;s.player.body.velocity.y=300;},'fall');
state('landing',s=>{s.landingStartedAt=1100;s.landingEndsAt=1280;},'land');
state('dodge',s=>{s.state='rolling';},'dash');
state('combo attack 1',s=>{s.state='attack-1';s.comboStep=0;},'attack_1');
state('combo attack 2',s=>{s.state='attack-2';s.comboStep=1;},'attack_2');
state('combo attack 3',s=>{s.state='attack-3';s.comboStep=2;},'attack_3');
state('hit',s=>{s.state='running';s.hitAnimStartsAt=1100;s.hitAnimEndsAt=1520;},'hit');
state('death',s=>{s.dead=true;s.hitAnimEndsAt=9999;s.state='attack-3';},'death');
state('hit priority over attack',s=>{s.hitAnimEndsAt=1500;s.state='attack-3';s.comboStep=2;},'hit');
state('attack priority over locomotion',s=>{s.state='attack-2';s.comboStep=1;},'attack_2');

{
  const s=scene({attackStartsAt:1000,attackEndsAt:1230,comboStep:0});
  s.queueAttack(1050);s.queueAttack(1070);
  assert.equal(s.queuedAttackCount,2);
  const started=[];
  s.startAttack=(time,step)=>{started.push(step);s.comboStep=step;s.attackStartsAt=time;s.attackEndsAt=time+100;};
  assert.equal(s.finishOrChainAttack(1230),true);
  assert.equal(started[0],1);
  assert.equal(s.queuedAttackCount,1);
  assert.equal(s.finishOrChainAttack(1330),true);
  assert.equal(started[1],2);
  assert.equal(s.queuedAttackCount,0);
}

{
  const s=scene({facing:-1});
  assert.equal(s.beginOrUpdateTurn('west',1000),true);
  s.beginOrUpdateTurn('west',1018);assert.equal(s.visualDirection,'south-east');
  s.beginOrUpdateTurn('west',1036);assert.equal(s.visualDirection,'south');
  s.beginOrUpdateTurn('west',1054);assert.equal(s.visualDirection,'south-west');
  s.beginOrUpdateTurn('west',1072);assert.equal(s.visualDirection,'west');
  s.beginOrUpdateTurn('west',1090);assert.equal(s.turning,false);
}
{
  const s=scene({facing:1,visualDirection:'west',turnTargetDirection:'west'});
  assert.equal(s.beginOrUpdateTurn('east',2000),true);
  s.beginOrUpdateTurn('east',2018);assert.equal(s.visualDirection,'north-west');
  s.beginOrUpdateTurn('east',2036);assert.equal(s.visualDirection,'north');
  s.beginOrUpdateTurn('east',2054);assert.equal(s.visualDirection,'north-east');
  s.beginOrUpdateTurn('east',2072);assert.equal(s.visualDirection,'east');
  s.beginOrUpdateTurn('east',2090);assert.equal(s.turning,false);
}

// V17's underlying frame mapping follows the same V26 contact windows; V18
// then applies the final per-animation visual phase tuning used by the live chain.
{
  const a1=scene({state:'attack-1',comboStep:0,attackStartsAt:1000});
  assert.equal(a1.attackFrame('attack_1','east',1052),2);
  assert.equal(a1.attackFrame('attack_1','east',1144),6);
  const a2=scene({state:'attack-2',comboStep:1,attackStartsAt:1000});
  assert.equal(a2.attackFrame('attack_2','east',1060),4);
  assert.equal(a2.attackFrame('attack_2','east',1164),6);
  const a3=scene({state:'attack-3',comboStep:2,attackStartsAt:1000});
  assert.equal(a3.attackFrame('attack_3','east',1080),4);
  assert.equal(a3.attackFrame('attack_3','east',1220),6);
}

{
  const s=scene({landingStartedAt:1000,landingEndsAt:1180,facing:-1});
  assert.equal(s.frameForState('land','west',1180),8);
}
{
  const s=scene({dead:true,deathAnimStartsAt:1000,pixelStateStartedAt:1000});
  assert.equal(s.frameForState('death','east',5000),7);
  assert.equal(s.frameForState('death','west',9000),7);
}

console.log('Today-only sword source, combo buffering, turning, and V26 frame-sync verification passed.');
