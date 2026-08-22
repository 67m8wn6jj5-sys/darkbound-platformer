import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests=[
  ['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {};\n'],
  ['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {};\n'],
  ['src/boss1Manifest.js','export const BOSS1_MANIFEST = {};\n'],
];
const created=[];
for(const [path,source] of temporaryManifests){
  if(!existsSync(path)){writeFileSync(path,source);created.push(path);}
}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});

globalThis.Phaser={
  Scene:class Scene{},
  BlendModes:{ADD:'ADD'},
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {GameSceneV28}=await import('../src/GameSceneV28.js');
const {GameSceneV29,reverseAttackFrameV29,reversedBladeTangentV29}=await import('../src/GameSceneV29.js');
const {PIXELLAB_MANIFEST}=await import('../src/pixellabManifest.js');
const {TUNING}=await import('../src/config.js');

assert.equal(PIXELLAB_MANIFEST.attack_1.sourceAnimation,'The_warrior_shifts_his_weight_forward_tightening_h');
assert.equal(PIXELLAB_MANIFEST.attack_1.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_1.west,8);

assert.deepEqual(TUNING.attackDurationsMs,[230,245,500]);
assert.deepEqual(TUNING.attackActiveStartMs,[52,60,80]);
assert.deepEqual(TUNING.attackActiveEndMs,[144,164,220]);
assert.deepEqual(TUNING.attackRanges,[80,88,104]);

const scene=Object.create(GameSceneV29.prototype);
scene.attackStartsAt=1000;
scene.comboStep=0;

const sampleTimes=[1000,1052,1098,1144,1230];
const forwardFrames=sampleTimes.map(time=>GameSceneV28.prototype.attackFrame.call(scene,'attack_1','east',time));
const reversedFrames=sampleTimes.map(time=>scene.attackFrame('attack_1','east',time));
assert.deepEqual(reversedFrames,forwardFrames.map(frame=>7-frame),'attack 1 must be the exact reverse of the approved 8-frame source sequence');
for(let i=1;i<reversedFrames.length;i++){
  assert.ok(reversedFrames[i]<=reversedFrames[i-1],`reversed attack frames must move downward: ${reversedFrames}`);
}
assert.equal(reversedFrames[0],7,'stab should begin from the original final/retracted pose');
assert.equal(reversedFrames.at(-1),0,'stab should finish at the original first/extended pose');

assert.equal(reverseAttackFrameV29('attack_1','west',0),7);
assert.equal(reverseAttackFrameV29('attack_1','west',7),0);
assert.equal(reverseAttackFrameV29('attack_2','east',4),4,'upward slash order must not change');
assert.equal(reverseAttackFrameV29('attack_3','east',5),5,'downward finisher order must not change');

const attack2=Object.create(GameSceneV29.prototype);attack2.attackStartsAt=2000;attack2.comboStep=1;
assert.equal(
  attack2.attackFrame('attack_2','east',2112),
  GameSceneV28.prototype.attackFrame.call(attack2,'attack_2','east',2112),
  'attack 2 playback must remain unchanged'
);
const attack3=Object.create(GameSceneV29.prototype);attack3.attackStartsAt=3000;attack3.comboStep=2;
assert.equal(
  attack3.attackFrame('attack_3','east',3150),
  GameSceneV28.prototype.attackFrame.call(attack3,'attack_3','east',3150),
  'attack 3 playback must remain unchanged'
);

assert.deepEqual(reversedBladeTangentV29(4),{x:-8,y:-24});
assert.deepEqual(reversedBladeTangentV29(3),{x:-14,y:-24});
assert.deepEqual(reversedBladeTangentV29(2),{x:-18,y:-14});

const source=readFileSync('src/GameSceneV29.js','utf8');
assert.match(source,/count-1-clamped/,'attack-1 playback must reverse frame indices rather than duplicate assets');
assert.match(source,/Number\(frame\)\+1/,'attack-1 blade history must follow descending frame order');
assert.match(source,/action!==['"]attack_1['"]/,'only the opener should receive the custom reversal/VFX path');

const main=readFileSync('src/main.js','utf8');
const v31=readFileSync('src/GameSceneV31.js','utf8');
const v30=readFileSync('src/GameSceneV30.js','utf8');
assert.match(main,/import \{ GameSceneV31 \} from '\.\/GameSceneV31\.js'/);
assert.match(main,/scene: \[GameSceneV31\]/);
assert.match(main,/GameSceneV31 -> GameSceneV30 -> GameSceneV29 -> GameSceneV28/,'latest live chain must preserve the V29 stab beneath V31');
assert.match(v31,/extends GameSceneV30/,'V31 must inherit V30');
assert.match(v30,/extends GameSceneV29/,'V30 must inherit the V29 reversed stab unchanged');

console.log('V29 reversed stab opener and reversed blade-trace inheritance verification passed.');
