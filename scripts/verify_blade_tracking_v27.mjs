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

globalThis.Phaser={Scene:class Scene{},BlendModes:{ADD:'ADD'},Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}}};

const {BLADE_TRACK_V27,bladeTangentV27}=await import('../src/GameSceneV27.js');
const {PIXELLAB_MANIFEST}=await import('../src/pixellabManifest.js');
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceArchive,'Sprite updates protagonist .zip');
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceAnimation,'The_character_raises_their_sword_in_a_swift_powerf');
assert.equal(PIXELLAB_MANIFEST.attack_3.east,8);assert.equal(PIXELLAB_MANIFEST.attack_3.west,8);
assert.match(PIXELLAB_MANIFEST.attack_3.gameplay,/grounded and airborne downward finisher/);
assert.deepEqual(Object.keys(BLADE_TRACK_V27),['attack_1','attack_2','attack_3']);
for(const [action,profile] of Object.entries(BLADE_TRACK_V27)){
  assert.ok(profile.outerAlpha<=.08);assert.ok(profile.innerAlpha<=.18);
  assert.ok(profile.outerWidth<=2.5);assert.ok(profile.innerWidth<=1);
  assert.ok(profile.lifeMs<=72);assert.ok(profile.moteAlpha<=.18);
  assert.ok(profile.moteLifeMs<=68);assert.ok(profile.moteDrift<=12);assert.ok(profile.moteFrames.length<=3);
  for(const anchor of Object.values(profile.frames)){
    const length=Math.hypot(anchor.tip[0]-anchor.root[0],anchor.tip[1]-anchor.root[1]);
    assert.ok(length>=45&&length<=105,`${action} blade anchor length drifted`);
  }
}
assert.ok(bladeTangentV27('attack_1',4).x>0);assert.ok(bladeTangentV27('attack_2',4).y<0);assert.ok(bladeTangentV27('attack_3',5).y>0);
const source=readFileSync('src/GameSceneV27.js','utf8');
assert.match(source,/bladeWorldPointV27/);assert.match(source,/previousTip\.x,previousTip\.y/);assert.match(source,/bladeTangentV27\(action,frame\)/);assert.match(source,/lerpPoint\(root,tip,\.88\)/);
assert.doesNotMatch(source,/Phaser\.Math\.Between/);assert.doesNotMatch(source,/super\.emitAttackMotionFx/);

const main=readFileSync('src/main.js','utf8');
const v34=readFileSync('src/GameSceneV34.js','utf8');
const v33=readFileSync('src/GameSceneV33.js','utf8');
const v32=readFileSync('src/GameSceneV32.js','utf8');
const v31=readFileSync('src/GameSceneV31.js','utf8');
const v30=readFileSync('src/GameSceneV30.js','utf8');
const v29=readFileSync('src/GameSceneV29.js','utf8');
assert.match(main,/import \{ GameSceneV34 \} from '\.\/GameSceneV34\.js'/);
assert.match(main,/GameSceneV34 -> GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29 -> GameSceneV28 -> GameSceneV27/);
assert.match(v34,/extends GameSceneV33/);assert.match(v33,/extends GameSceneV32/);assert.match(v32,/extends GameSceneV31/);assert.match(v31,/extends GameSceneV30/);assert.match(v30,/extends GameSceneV29/);assert.match(v29,/extends GameSceneV28/);
console.log('V27 blade-locked VFX verification passed beneath V34.');
