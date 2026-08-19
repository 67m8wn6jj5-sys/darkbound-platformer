import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests = [
  ['src/enemy1Manifest.js', 'export const ENEMY1_MANIFEST = {};\n'],
  ['src/enemy2Manifest.js', 'export const ENEMY2_MANIFEST = {};\n'],
  ['src/boss1Manifest.js', 'export const BOSS1_MANIFEST = {};\n'],
];
const created=[];
for(const [path,source] of temporaryManifests){if(!existsSync(path)){writeFileSync(path,source);created.push(path);}}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});

globalThis.Phaser={Scene:class Scene{},BlendModes:{ADD:'ADD'},Math:{Between:(a)=>a}};
const {GameSceneV18,PROTAGONIST_ART_SCALE_V18}=await import('../src/GameSceneV18.js');
const {PIXELLAB_MANIFEST}=await import('../src/pixellabManifest.js');
const {TUNING}=await import('../src/config.js');

assert.equal(PROTAGONIST_ART_SCALE_V18,.4554);
assert.ok(Math.abs(PROTAGONIST_ART_SCALE_V18/.396-1.15)<1e-12,'V18 art scale must be exactly 15% above V17');
const mainSource=readFileSync('src/main.js','utf8');
const v21Source=readFileSync('src/GameSceneV21.js','utf8');
const v20Source=readFileSync('src/GameSceneV20.js','utf8');
const v19Source=readFileSync('src/GameSceneV19.js','utf8');
assert.match(mainSource,/GameSceneV21/,'main must boot the current combat scene');
assert.match(v21Source,/extends GameSceneV20/,'V21 must preserve Combat Pass 2 through inheritance');
assert.match(v20Source,/extends GameSceneV19/,'V20 must preserve Combat Pass 1 through inheritance');
assert.match(v19Source,/extends GameSceneV18/,'live combat chain must preserve V18 protagonist behavior through inheritance');

assert.equal(PIXELLAB_MANIFEST.attack_alt.sourceAnimation,'The_character_firmly_pivots_their_weight_onto_thei');
assert.equal(PIXELLAB_MANIFEST.attack_alt.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_alt.west,8);
assert.equal(PIXELLAB_MANIFEST.attack_alt.sourceArchive,'Protagonist update.zip');
assert.equal(PIXELLAB_MANIFEST.attack_alt.rotationArchive,'Sprite updates protagonist .zip');

const s=Object.create(GameSceneV18.prototype);s.comboStep=0;s.attackPatternIndex=0;
assert.equal(s.attackVisualForStep(0,0),'attack_1');assert.equal(s.attackVisualForStep(1,0),'attack_2');assert.equal(s.attackVisualForStep(2,0),'attack_3');
assert.equal(s.attackVisualForStep(0,1),'attack_alt');assert.equal(s.attackVisualForStep(1,1),'attack_2');assert.equal(s.attackVisualForStep(0,2),'attack_1');assert.equal(s.attackVisualForStep(1,2),'attack_alt');assert.equal(s.attackVisualForStep(2,2),'attack_3');
assert.deepEqual(TUNING.attackDurationsMs,[185,195,430]);
assert.deepEqual(TUNING.attackActiveStartMs,[42,48,68]);
assert.deepEqual(TUNING.attackActiveEndMs,[122,138,190]);

s.attackStartsAt=1000;s.comboStep=0;
const altFrames=[s.attackFrame('attack_alt','east',1000),s.attackFrame('attack_alt','east',1042),s.attackFrame('attack_alt','east',1080),s.attackFrame('attack_alt','east',1122),s.attackFrame('attack_alt','east',1185)];
for(let i=1;i<altFrames.length;i++)assert.ok(altFrames[i]>=altFrames[i-1],`alternate swing frames must advance monotonically: ${altFrames}`);
assert.ok(altFrames[1]>=2&&altFrames[3]<=6,'alternate active frames must line up with attack-1 contact window');
s.comboStep=2;const finisherEnd=s.attackFrame('attack_3','east',1430);assert.equal(finisherEnd,7,'heavy finisher must reach its final recovery frame by the shortened end time');
console.log('V18 protagonist scale, attack variation, and recovery timing verification passed.');
