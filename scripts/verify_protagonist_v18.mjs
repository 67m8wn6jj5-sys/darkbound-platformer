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

globalThis.Phaser={Scene:class Scene{},BlendModes:{ADD:'ADD'},Math:{Between:(a)=>a}};
const {GameSceneV18,PROTAGONIST_ART_SCALE_V18}=await import('../src/GameSceneV18.js');
const {TUNING}=await import('../src/config.js');

assert.equal(PROTAGONIST_ART_SCALE_V18,.4554);
assert.ok(Math.abs(PROTAGONIST_ART_SCALE_V18/.396-1.15)<1e-12,'V18 art scale must be exactly 15% above V17');
const mainSource=readFileSync('src/main.js','utf8');
const v22Source=readFileSync('src/GameSceneV22.js','utf8');
const v21Source=readFileSync('src/GameSceneV21.js','utf8');
const v20Source=readFileSync('src/GameSceneV20.js','utf8');
const v19Source=readFileSync('src/GameSceneV19.js','utf8');
assert.match(mainSource,/GameSceneV22/,'main must boot the current environment/combat inheritance chain');
assert.match(v22Source,/extends GameSceneV21/,'V22 must preserve V21 through inheritance');
assert.match(v21Source,/extends GameSceneV20/,'V21 must preserve Combat Pass 2 through inheritance');
assert.match(v20Source,/extends GameSceneV19/,'V20 must preserve Combat Pass 1 through inheritance');
assert.match(v19Source,/extends GameSceneV18/,'live chain must preserve V18 protagonist behavior through inheritance');

const s=Object.create(GameSceneV18.prototype);s.comboStep=0;s.attackPatternIndex=0;
for(const patternIndex of [0,1,2,7,42]){
  assert.equal(s.attackVisualForStep(0,patternIndex),'attack_1','opening hit must use the approved normal slash');
  assert.equal(s.attackVisualForStep(1,patternIndex),'attack_2','second hit must use the approved second slash');
  assert.equal(s.attackVisualForStep(2,patternIndex),'attack_3','finisher must use the approved heavy slash');
  assert.notEqual(s.attackVisualForStep(0,patternIndex),'attack_alt','retired waist-height sweep must never be selected');
  assert.notEqual(s.attackVisualForStep(1,patternIndex),'attack_alt','retired waist-height sweep must never be selected');
  assert.notEqual(s.attackVisualForStep(2,patternIndex),'attack_alt','retired waist-height sweep must never be selected');
}
assert.deepEqual(TUNING.attackDurationsMs,[185,195,430]);
assert.deepEqual(TUNING.attackActiveStartMs,[42,48,68]);
assert.deepEqual(TUNING.attackActiveEndMs,[122,138,190]);

s.attackStartsAt=1000;s.comboStep=0;
const attack1Frames=[s.attackFrame('attack_1','east',1000),s.attackFrame('attack_1','east',1042),s.attackFrame('attack_1','east',1080),s.attackFrame('attack_1','east',1122),s.attackFrame('attack_1','east',1185)];
for(let i=1;i<attack1Frames.length;i++)assert.ok(attack1Frames[i]>=attack1Frames[i-1],`opening slash frames must advance monotonically: ${attack1Frames}`);
assert.ok(attack1Frames[1]>=3&&attack1Frames[3]<=6,'opening slash active frames must line up with attack-1 contact window');
s.comboStep=2;const finisherEnd=s.attackFrame('attack_3','east',1430);assert.equal(finisherEnd,7,'heavy finisher must reach its final recovery frame by the shortened end time');

const source=readFileSync('src/GameSceneV18.js','utf8');
assert.match(source,/Object\.freeze\(\['attack_1','attack_2','attack_3'\]\)/,'live combo pattern must use only the approved three standard attacks');
assert.doesNotMatch(source,/action===this\.lastVisualAttackAction&&PIXELLAB_MANIFEST\.attack_alt/,'repeated attacks must not re-inject the retired waist-height sweep');

console.log('V18 protagonist scale, approved sword combo, and recovery timing verification passed.');
