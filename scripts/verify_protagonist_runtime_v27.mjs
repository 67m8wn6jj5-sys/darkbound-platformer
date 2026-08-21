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
  Scene:class Scene{},BlendModes:{ADD:'ADD'},
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {GameSceneV17}=await import('../src/GameSceneV17.js');
const {GameSceneV18,PROTAGONIST_ART_SCALE_V18}=await import('../src/GameSceneV18.js');
const {resolveSwordStep}=await import('../src/GameSceneV25.js');
const {PIXELLAB_MANIFEST}=await import('../src/pixellabManifest.js');
const {TUNING}=await import('../src/config.js');

const BASE='Sprite updates protagonist .zip';
const TODAY_SWORD='Recreate_this_character-Sword_attack.zip';
const TODAY_KO='Recreate_this_character-Ko_Gasumi_sword_atta.zip';
assert.equal(PROTAGONIST_ART_SCALE_V18,.4554);
assert.equal(PIXELLAB_MANIFEST.attack_1.sourceArchive,TODAY_KO);
assert.equal(PIXELLAB_MANIFEST.attack_2.sourceArchive,TODAY_SWORD);
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceArchive,BASE);
assert.equal(PIXELLAB_MANIFEST.attack_1.sourceAnimation,'The_warrior_shifts_his_weight_forward_tightening_h');
assert.equal(PIXELLAB_MANIFEST.attack_2.sourceAnimation,'Upward_sword_slash._Starting_from_the_feet_and_fin');
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceAnimation,'The_character_raises_their_sword_in_a_swift_powerf');
assert.equal(PIXELLAB_MANIFEST.attack_1.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_2.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_3.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_3.west,8);
assert.ok(!('attack_alt' in PIXELLAB_MANIFEST));

assert.deepEqual(TUNING.attackDurationsMs,[230,245,500]);
assert.deepEqual(TUNING.attackActiveStartMs,[52,60,80]);
assert.deepEqual(TUNING.attackActiveEndMs,[144,164,220]);
assert.equal(resolveSwordStep(100,200,0,null),1);
assert.equal(resolveSwordStep(100,200,1,null),2);
assert.equal(resolveSwordStep(100,200,2,null),0,'third strike must wrap to the opening strike');

function scene(overrides={}){
  const s=Object.create(GameSceneV17.prototype);
  Object.assign(s,{
    dead:false,hitAnimEndsAt:-Infinity,hitAnimStartsAt:-Infinity,deathAnimStartsAt:-Infinity,
    state:'idle',comboStep:0,facing:1,attackStartsAt:1000,attackEndsAt:1230,
    attackQueued:false,queuedAttackCount:0,lastRollAt:1000,landingStartedAt:-Infinity,
    landingEndsAt:-Infinity,pixelStateStartedAt:1000,visualDirection:'east',turnTargetDirection:'east',
    turning:false,nextTurnStepAt:0,player:{body:{blocked:{down:true},velocity:{x:0,y:0}}},
  },overrides);
  return s;
}

const slots=scene();
assert.equal(slots.attackActionForStep(0),'attack_1');
assert.equal(slots.attackActionForStep(1),'attack_2');
assert.equal(slots.attackActionForStep(2),'attack_3');

const buffered=scene({attackStartsAt:1000,attackEndsAt:1230,comboStep:0});
buffered.queueAttack(1050);buffered.queueAttack(1070);
assert.equal(buffered.queuedAttackCount,2);
const started=[];
buffered.startAttack=(time,step)=>{started.push(step);buffered.comboStep=step;buffered.attackStartsAt=time;buffered.attackEndsAt=time+100;};
assert.equal(buffered.finishOrChainAttack(1230),true);
assert.equal(buffered.finishOrChainAttack(1330),true);
assert.deepEqual(started,[1,2],'rapid triple tap must still play all three combo slots');

const turn=scene({facing:-1});
assert.equal(turn.beginOrUpdateTurn('west',1000),true);
turn.beginOrUpdateTurn('west',1018);assert.equal(turn.visualDirection,'south-east');
turn.beginOrUpdateTurn('west',1036);assert.equal(turn.visualDirection,'south');
turn.beginOrUpdateTurn('west',1054);assert.equal(turn.visualDirection,'south-west');
turn.beginOrUpdateTurn('west',1072);assert.equal(turn.visualDirection,'west');

const v18=Object.create(GameSceneV18.prototype);v18.attackPatternIndex=0;
for(const i of [0,1,9]){
  assert.equal(v18.attackVisualForStep(0,i),'attack_1');
  assert.equal(v18.attackVisualForStep(1,i),'attack_2');
  assert.equal(v18.attackVisualForStep(2,i),'attack_3');
}
v18.attackStartsAt=3000;v18.comboStep=2;
assert.equal(v18.attackFrame('attack_3','east',3080),3);
assert.equal(v18.attackFrame('attack_3','east',3220),7);
assert.equal(v18.attackFrame('attack_3','east',3500),7,'8-frame downward finisher must finish on frame 7');

const main=readFileSync('src/main.js','utf8');
assert.match(main,/GameSceneV27/);
assert.match(main,/GameSceneV24/,'V27 must preserve the existing stage-flow inheritance chain');
console.log('V27 protagonist source, combo, turning, buffering, and frame-sync verification passed.');
