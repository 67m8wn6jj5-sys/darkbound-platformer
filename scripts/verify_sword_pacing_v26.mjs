import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {TUNING}=await import('../src/config.js');
const {SWORD_VFX_V26}=await import('../src/GameSceneV26.js');

assert.deepEqual(TUNING.attackDurationsMs,[230,245,500],'new sword art must play at the slower V26 cadence');
assert.deepEqual(TUNING.attackActiveStartMs,[52,60,80]);
assert.deepEqual(TUNING.attackActiveEndMs,[144,164,220]);
assert.ok(TUNING.attackDurationsMs[0]>=225&&TUNING.attackDurationsMs[0]<=250,'attack 1 should stay readable without becoming sluggish');
assert.ok(TUNING.attackDurationsMs[1]>=240&&TUNING.attackDurationsMs[1]<=265,'attack 2 should stay readable without becoming sluggish');
assert.ok(TUNING.attackDurationsMs[2]>=480&&TUNING.attackDurationsMs[2]<=525,'finisher should retain weight without excessive recovery');

assert.deepEqual(Object.keys(SWORD_VFX_V26),['attack_1','attack_2','attack_3']);
const a1=SWORD_VFX_V26.attack_1;
const a2=SWORD_VFX_V26.attack_2;
const a3=SWORD_VFX_V26.attack_3;
for(const [name,p] of Object.entries(SWORD_VFX_V26)){
  assert.ok(p.outerAlpha<=.09,`${name} outer glow must remain very faint`);
  assert.ok(p.innerAlpha<=.27,`${name} inner blade afterimage must remain subtle`);
  assert.ok(p.outerWidth<=4,`${name} must not return to thick neon sword bands`);
  assert.ok(p.innerWidth<=1.6,`${name} core trail must stay thin`);
  assert.ok(p.sparks<=2,`${name} must use at most two tiny sparks`);
  assert.ok(p.lifeMs<=100,`${name} trail must disappear quickly`);
}
assert.ok(a1.endDeg>a1.startDeg,'attack 1 keeps a forward sweep');
assert.ok(a2.endDeg<a2.startDeg,'attack 2 keeps a rising trajectory');
assert.ok(Math.abs(a3.endDeg-a3.startDeg)>Math.abs(a1.endDeg-a1.startDeg),'attack 3 remains the broadest sweep');
assert.ok(a3.radius>a2.radius&&a2.radius>a1.radius,'effect scale should still match attack commitment');

const source=readFileSync('src/GameSceneV26.js','utf8');
assert.doesNotMatch(source,/spawnGreenBurst|spawnCombatShockwave/,'V26 sword swings must not use large burst effects');
assert.doesNotMatch(source,/profile\.width\*2|particles:6|\.92\}/,'V26 must not recreate the old bright multi-layer trail');
assert.match(source,/frame!==profile\.sparkFrame/,'sparks must be limited to one deliberate contact frame per attack');

const main=readFileSync('src/main.js','utf8');
assert.match(main,/scene: \[GameSceneV26\]/,'main must boot the slower/subtle V26 sword pass');

console.log('V26 slower sword pacing and subtle VFX verification passed.');
