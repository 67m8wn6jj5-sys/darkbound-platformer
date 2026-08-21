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

globalThis.Phaser={Scene:class Scene{},BlendModes:{ADD:'ADD'},Math:{Between:(a)=>a}};
const {resolveSwordStep,SWORD_VFX_V25}=await import('../src/GameSceneV25.js');

assert.equal(resolveSwordStep(100,50,2,null),0,'expired combo must restart at attack 1');
assert.equal(resolveSwordStep(100,200,0,null),1,'attack 1 must advance to attack 2');
assert.equal(resolveSwordStep(100,200,1,null),2,'attack 2 must advance to attack 3');
assert.equal(resolveSwordStep(100,200,2,null),0,'attack 3 must wrap to attack 1 instead of replaying attack 3');
assert.equal(resolveSwordStep(100,200,2,1),1,'explicit queued combo step must be preserved');

assert.deepEqual(Object.keys(SWORD_VFX_V25),['attack_1','attack_2','attack_3']);
const a1=SWORD_VFX_V25.attack_1;
const a2=SWORD_VFX_V25.attack_2;
const a3=SWORD_VFX_V25.attack_3;
assert.ok(a1.endDeg>a1.startDeg,'attack 1 should be a compact forward sweep');
assert.ok(a2.endDeg<a2.startDeg,'attack 2 must travel upward through its arc');
assert.ok(Math.abs(a3.endDeg-a3.startDeg)>Math.abs(a1.endDeg-a1.startDeg),'attack 3 must have a broader finishing sweep than attack 1');
assert.ok(a2.particleY<0,'upward slash particles must travel upward');
assert.ok(a1.particleX>0,'forward slash particles must travel forward');
assert.ok(a3.particles>a1.particles,'finisher must have stronger particle density');
assert.ok(a3.radius>a2.radius&&a2.radius>a1.radius,'trail radius should grow with attack commitment');
assert.notDeepEqual(a1.frames,a3.frames,'finisher must use its own longer active visual frame path');

const source=readFileSync('src/GameSceneV25.js','utf8');
assert.match(source,/\(Math\.max\(0,Math\.min\(2,Number\(comboStep\)\|\|0\)\)\+1\)%3/,'normal sword sequencing must wrap modulo 3');
assert.match(source,/trail\.arc\(/,'V25 must retain curved blade-path support underneath V26');
assert.doesNotMatch(source,/super\.emitAttackMotionFx/,'V25 must fully replace the old generic sword VFX path');

const main=readFileSync('src/main.js','utf8');
const v26=readFileSync('src/GameSceneV26.js','utf8');
assert.match(main,/import \{ GameSceneV26 \} from '\.\/GameSceneV26\.js'/,'main must import V26');
assert.match(main,/scene: \[GameSceneV26\]/,'main must boot V26');
assert.match(v26,/extends GameSceneV25/,'V26 must preserve the fixed V25 combo cycling through inheritance');

console.log('Sword cycling and V25 inheritance verification passed under V26.');
