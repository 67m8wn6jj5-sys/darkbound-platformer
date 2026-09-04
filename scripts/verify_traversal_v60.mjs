import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TUNING } from '../src/config.js';

const REQUIRED_CATHEDRAL_STEP_PX=128;
const REQUIRED_CLEARANCE_PX=30;
const fullHoldApex=(TUNING.jumpVelocity*TUNING.jumpVelocity)/(2*TUNING.gravityY);
const releasedApex=(TUNING.jumpVelocity*TUNING.jumpVelocity)/(2*TUNING.gravityY*TUNING.lowJumpGravityMultiplier);

// V38's entry floor is y=2448 and its first route ledge is y=2320: a 128 px
// ascent. Give the player useful forgiveness rather than tuning exactly to the
// mathematical edge of that platform.
assert.ok(fullHoldApex>=REQUIRED_CATHEDRAL_STEP_PX+REQUIRED_CLEARANCE_PX,
  `Full-hold jump apex ${fullHoldApex.toFixed(1)}px is too low for the 128px cathedral step.`);
assert.ok(fullHoldApex<=190,
  `Full-hold jump apex ${fullHoldApex.toFixed(1)}px is high enough to skip too much authored traversal.`);

// Releasing jump still needs to produce a materially shorter hop so platform
// control remains useful after increasing the full jump.
assert.ok(releasedApex>=60&&releasedApex<=95,
  `Released jump apex ${releasedApex.toFixed(1)}px is outside the intended short-hop range.`);
assert.equal(TUNING.jumpVelocity,-700);
assert.equal(TUNING.gravityY,1450);
assert.equal(TUNING.lowJumpGravityMultiplier,2.25);

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const patch=fs.readFileSync(new URL('../src/GameSceneV60.js',import.meta.url),'utf8');
assert.match(main,/GameSceneV60\.js\?v=v60-cathedral-jump-reach-20260904-1/);
assert.match(main,/dataset\.build='v60'/);
assert.match(index,/V60 • BOOT/);
assert.match(index,/main\.js\?v=v60-cathedral-jump-reach-20260904-1/);
assert.match(patch,/V60_FULL_HOLD_APEX_PX/);

console.log('V60 traversal verification passed.');
console.log(`Full-hold apex: ${fullHoldApex.toFixed(1)}px; released apex: ${releasedApex.toFixed(1)}px; required cathedral step: ${REQUIRED_CATHEDRAL_STEP_PX}px.`);
