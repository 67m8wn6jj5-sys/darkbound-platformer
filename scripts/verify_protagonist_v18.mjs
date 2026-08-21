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
const {PIXELLAB_MANIFEST}=await import('../src/pixellabManifest.js');
const {TUNING}=await import('../src/config.js');

const TODAY_SWORD='Recreate_this_character-Sword_attack.zip';
const TODAY_KO='Recreate_this_character-Ko_Gasumi_sword_atta.zip';

assert.equal(PROTAGONIST_ART_SCALE_V18,.4554);
assert.ok(Math.abs(PROTAGONIST_ART_SCALE_V18/.396-1.15)<1e-12,'V18 art scale must remain exactly 15% above V17');
const mainSource=readFileSync('src/main.js','utf8');
const v22Source=readFileSync('src/GameSceneV22.js','utf8');
const v21Source=readFileSync('src/GameSceneV21.js','utf8');
const v20Source=readFileSync('src/GameSceneV20.js','utf8');
const v19Source=readFileSync('src/GameSceneV19.js','utf8');
assert.match(mainSource,/GameSceneV24/,'main must boot the current V24 environment/combat inheritance chain');
assert.match(v22Source,/extends GameSceneV21/);
assert.match(v21Source,/extends GameSceneV20/);
assert.match(v20Source,/extends GameSceneV19/);
assert.match(v19Source,/extends GameSceneV18/);

assert.equal(PIXELLAB_MANIFEST.attack_1.sourceArchive,TODAY_KO);
assert.equal(PIXELLAB_MANIFEST.attack_2.sourceArchive,TODAY_SWORD);
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceArchive,TODAY_SWORD);
assert.equal(PIXELLAB_MANIFEST.attack_1.sourceAnimation,'The_warrior_shifts_his_weight_forward_tightening_h');
assert.equal(PIXELLAB_MANIFEST.attack_2.sourceAnimation,'Upward_sword_slash._Starting_from_the_feet_and_fin');
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceAnimation,'The_warrior_shifts_his_weight_forward_tightening_h');
assert.equal(PIXELLAB_MANIFEST.attack_1.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_2.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_3.east,9);
assert.ok(!('attack_alt' in PIXELLAB_MANIFEST),'legacy attack_alt must not exist in the generated runtime manifest');
for(const action of ['attack_1','attack_2','attack_3']){
  assert.ok([TODAY_KO,TODAY_SWORD].includes(PIXELLAB_MANIFEST[action].sourceArchive),'all sword strikes must be from today');
  assert.notEqual(PIXELLAB_MANIFEST[action].sourceAnimation,'The_character_shifts_their_weight_slightly_to_plan');
  assert.notEqual(PIXELLAB_MANIFEST[action].sourceAnimation,'The_character_raises_their_sword_in_a_swift_powerf');
}

const s=Object.create(GameSceneV18.prototype);s.comboStep=0;s.attackPatternIndex=0;
for(const patternIndex of [0,1,2,7,42]){
  assert.equal(s.attackVisualForStep(0,patternIndex),'attack_1');
  assert.equal(s.attackVisualForStep(1,patternIndex),'attack_2');
  assert.equal(s.attackVisualForStep(2,patternIndex),'attack_3');
}
assert.deepEqual(TUNING.attackDurationsMs,[185,195,430]);
assert.deepEqual(TUNING.attackActiveStartMs,[42,48,68]);
assert.deepEqual(TUNING.attackActiveEndMs,[122,138,190]);

s.attackStartsAt=1000;s.comboStep=0;
const attack1Frames=[s.attackFrame('attack_1','east',1000),s.attackFrame('attack_1','east',1042),s.attackFrame('attack_1','east',1080),s.attackFrame('attack_1','east',1122),s.attackFrame('attack_1','east',1185)];
for(let i=1;i<attack1Frames.length;i++)assert.ok(attack1Frames[i]>=attack1Frames[i-1],`attack-1 frames must advance monotonically: ${attack1Frames}`);
assert.equal(attack1Frames[1],2);
assert.equal(attack1Frames[3],5);

s.attackStartsAt=2000;s.comboStep=1;
const attack2Frames=[s.attackFrame('attack_2','east',2000),s.attackFrame('attack_2','east',2048),s.attackFrame('attack_2','east',2093),s.attackFrame('attack_2','east',2138),s.attackFrame('attack_2','east',2195)];
for(let i=1;i<attack2Frames.length;i++)assert.ok(attack2Frames[i]>=attack2Frames[i-1],`upward-slash frames must advance monotonically: ${attack2Frames}`);
assert.equal(attack2Frames[1],2);
assert.equal(attack2Frames[3],5);

s.attackStartsAt=3000;s.comboStep=2;
assert.equal(s.attackFrame('attack_3','east',3068),3,'finisher contact should enter on frame 3');
assert.equal(s.attackFrame('attack_3','east',3190),7,'finisher contact should leave on frame 7');
assert.equal(s.attackFrame('attack_3','east',3430),8,'9-frame finisher must reach its final recovery frame');

const source=readFileSync('src/GameSceneV18.js','utf8');
assert.match(source,/Object\.freeze\(\['attack_1','attack_2','attack_3'\]\)/,'live combo must be exactly the three today-sourced attacks');
assert.doesNotMatch(source,/attack_alt/,'legacy alternate attack code must be removed from live V18');
assert.match(source,/attack_1:\{activeFirst:2,activeLast:5/);
assert.match(source,/attack_2:\{activeFirst:2,activeLast:5/);
assert.match(source,/attack_3:\{activeFirst:3,activeLast:7/);

console.log('V18 today-only three-strike combo and visual timing verification passed.');
