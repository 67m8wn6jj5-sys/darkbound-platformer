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
  Scene:class Scene{},
  BlendModes:{ADD:'ADD'},
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {BLADE_TRACK_V27,bladeTangentV27}=await import('../src/GameSceneV27.js');
const {PIXELLAB_MANIFEST}=await import('../src/pixellabManifest.js');

const BASE='Sprite updates protagonist .zip';
const DOWNWARD='The_character_raises_their_sword_in_a_swift_powerf';
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceArchive,BASE,'grounded finisher must reuse the approved current-archive downward cut');
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceAnimation,DOWNWARD);
assert.equal(PIXELLAB_MANIFEST.attack_3.east,8);
assert.equal(PIXELLAB_MANIFEST.attack_3.west,8);
assert.match(PIXELLAB_MANIFEST.attack_3.gameplay,/grounded and airborne downward finisher/);

assert.deepEqual(Object.keys(BLADE_TRACK_V27),['attack_1','attack_2','attack_3']);
for(const [action,profile] of Object.entries(BLADE_TRACK_V27)){
  assert.ok(profile.outerAlpha<=.08,`${action} outer afterimage must remain extremely subtle`);
  assert.ok(profile.innerAlpha<=.18,`${action} inner afterimage must remain subordinate to sprite art`);
  assert.ok(profile.outerWidth<=2.5,`${action} outer line must hug the blade`);
  assert.ok(profile.innerWidth<=1,`${action} inner line must stay blade-thin`);
  assert.ok(profile.lifeMs<=72,`${action} blade trace must vanish quickly`);
  assert.ok(profile.moteAlpha<=.18,`${action} motes must remain faint`);
  assert.ok(profile.moteLifeMs<=68,`${action} motes must be short-lived`);
  assert.ok(profile.moteDrift<=12,`${action} motes must stay close to the blade path`);
  assert.ok(profile.moteFrames.length<=3,`${action} must not spray particles every frame`);
  for(const anchor of Object.values(profile.frames)){
    const length=Math.hypot(anchor.tip[0]-anchor.root[0],anchor.tip[1]-anchor.root[1]);
    assert.ok(length>=45&&length<=105,`${action} afterimage should describe the blade, not a character-sized arc`);
  }
}

const forward=bladeTangentV27('attack_1',4);
const rising=bladeTangentV27('attack_2',4);
const downward=bladeTangentV27('attack_3',5);
assert.ok(forward.x>0,'opening-cut mote motion should inherit forward blade travel in the underlying V27 profile');
assert.ok(rising.y<0,'upward-cut mote motion must inherit upward blade travel');
assert.ok(downward.y>0,'downward-finisher mote motion must inherit descending blade travel');

const source=readFileSync('src/GameSceneV27.js','utf8');
assert.match(source,/bladeWorldPointV27/,'V27 must transform authored blade anchors into world space');
assert.match(source,/previousTip\.x,previousTip\.y/,'V27 must trace the frame-to-frame sword-tip path');
assert.match(source,/bladeTangentV27\(action,frame\)/,'mote velocity must derive from blade motion');
assert.match(source,/lerpPoint\(root,tip,\.88\)/,'motes must originate directly on the distal blade');
assert.doesNotMatch(source,/Phaser\.Math\.Between/,'V27 sword motes must not use generic random spray physics');
assert.doesNotMatch(source,/super\.emitAttackMotionFx/,'V27 must fully replace the old character-centered effect');

const main=readFileSync('src/main.js','utf8');
const v31=readFileSync('src/GameSceneV31.js','utf8');
const v30=readFileSync('src/GameSceneV30.js','utf8');
const v29=readFileSync('src/GameSceneV29.js','utf8');
assert.match(main,/import \{ GameSceneV31 \} from '\.\/GameSceneV31\.js'/,'current main must boot the latest scene');
assert.match(main,/GameSceneV31 -> GameSceneV30 -> GameSceneV29 -> GameSceneV28 -> GameSceneV27/,'current live chain must retain V27 blade tracking underneath later passes');
assert.match(v31,/extends GameSceneV30/,'V31 must preserve V30');
assert.match(v30,/extends GameSceneV29/,'V30 must preserve V29 attack behavior');
assert.match(v29,/extends GameSceneV28/,'V29 must preserve V28, which inherits V27');

console.log('V27 restored downward ground finisher and blade-locked VFX inheritance verification passed.');
