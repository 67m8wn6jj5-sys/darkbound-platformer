import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COMBAT_V59,
  segmentIntersectsAabbV59,
  bladeSweepIntersectsAabbV59,
} from '../src/combatRulesV59.js';

const box={left:40,right:60,top:-10,bottom:10};
assert.equal(segmentIntersectsAabbV59({x:0,y:0},{x:100,y:0},box,0),true);
assert.equal(segmentIntersectsAabbV59({x:0,y:25},{x:100,y:25},box,0),false);
assert.equal(segmentIntersectsAabbV59({x:0,y:15},{x:100,y:15},box,6),true);

// Two discrete blade poses both miss, but their frame-to-frame sweep crosses
// the target. V59 must catch this instead of tunneling at low frame rates.
const sweepBox={left:14,right:26,top:-5,bottom:5};
const previous={root:{x:0,y:-30},tip:{x:32,y:-30}};
const current={root:{x:0,y:30},tip:{x:32,y:30}};
assert.equal(segmentIntersectsAabbV59(previous.root,previous.tip,sweepBox,0),false);
assert.equal(segmentIntersectsAabbV59(current.root,current.tip,sweepBox,0),false);
assert.equal(bladeSweepIntersectsAabbV59(previous,current,sweepBox,0,COMBAT_V59.sweepSamples),true);

const missBox={left:70,right:90,top:-5,bottom:5};
assert.equal(bladeSweepIntersectsAabbV59(previous,current,missBox,0,COMBAT_V59.sweepSamples),false);
assert.ok(COMBAT_V59.bladeRadius>=4&&COMBAT_V59.bladeRadius<=12);
assert.ok(COMBAT_V59.sweepSamples>=4);

const patch=fs.readFileSync(new URL('../src/GameSceneV59.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(patch,/BLADE_TRACK_V27/);
assert.match(patch,/bladeWorldPointV27/);
assert.match(patch,/bladeSweepIntersectsAabbV59/);
assert.match(patch,/GameSceneV38\.prototype\.updateAttack=function/);
assert.doesNotMatch(patch,/attackRanges/);
assert.doesNotMatch(patch,/previousUpdateAttack/);
assert.match(main,/GameSceneV59\.js\?v=v59-blade-tracked-collision-20260904-1/);
assert.match(main,/dataset\.build='v59'/);
assert.match(index,/V59 • BOOT/);
assert.match(index,/main\.js\?v=v59-blade-tracked-collision-20260904-1/);

console.log('V59 blade-tracked collision verification passed.');
console.log(`Blade radius: ${COMBAT_V59.bladeRadius}px; sweep samples: ${COMBAT_V59.sweepSamples}.`);
