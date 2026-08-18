import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests = [
  ['src/enemy1Manifest.js', 'export const ENEMY1_MANIFEST = {};\n'],
  ['src/enemy2Manifest.js', 'export const ENEMY2_MANIFEST = {};\n'],
  ['src/boss1Manifest.js', 'export const BOSS1_MANIFEST = {};\n'],
];
const created = [];
for (const [path, source] of temporaryManifests) {
  if (!existsSync(path)) {
    writeFileSync(path, source);
    created.push(path);
  }
}
process.on('exit', () => {
  for (const path of created) {
    try { unlinkSync(path); } catch {}
  }
});

globalThis.Phaser = { Scene: class Scene {} };
const { GameSceneV17 } = await import('../src/GameSceneV17.js');
const { PIXELLAB_MANIFEST } = await import('../src/pixellabManifest.js');

function scene(overrides = {}) {
  const s = Object.create(GameSceneV17.prototype);
  Object.assign(s, {
    dead: false,
    hitAnimEndsAt: -Infinity,
    hitAnimStartsAt: -Infinity,
    deathAnimStartsAt: -Infinity,
    state: 'idle',
    comboStep: 0,
    facing: 1,
    attackStartsAt: 1000,
    attackEndsAt: 1195,
    attackQueued: false,
    queuedAttackCount: 0,
    lastRollAt: 1000,
    landingStartedAt: -Infinity,
    landingEndsAt: -Infinity,
    pixelStateStartedAt: 1000,
    visualDirection: 'east',
    turnTargetDirection: 'east',
    turning: false,
    nextTurnStepAt: 0,
    player: { body: { blocked: { down: true }, velocity: { x: 0, y: 0 } } },
  }, overrides);
  return s;
}

function state(name, mutator, expected, time = 1200) {
  const s = scene();
  mutator(s);
  assert.equal(s.resolvePixelState(time), expected, name);
}

// Production visual scale must remain exactly ten percent above the previous
// 0.36 value. Grounding math uses the same constant.
assert.match(readFileSync('src/GameSceneV17.js', 'utf8'), /const ART_SCALE=\.396;/);

// The latest archive must expose three genuinely different sword sequences.
assert.equal(PIXELLAB_MANIFEST.attack_1.sourceAnimation, 'The_character_shifts_their_weight_slightly_to_plan');
assert.equal(PIXELLAB_MANIFEST.attack_2.sourceAnimation, 'The_warrior_pivots_his_hips_and_drives_his_sword_i');
assert.equal(PIXELLAB_MANIFEST.attack_3.sourceAnimation, 'The_character_raises_their_sword_in_a_swift_powerf');
assert.notEqual(PIXELLAB_MANIFEST.attack_1.sourceAnimation, PIXELLAB_MANIFEST.attack_2.sourceAnimation);
assert.notEqual(PIXELLAB_MANIFEST.attack_2.sourceAnimation, PIXELLAB_MANIFEST.attack_3.sourceAnimation);

{
  const s=scene();
  assert.equal(s.attackActionForStep(0),'attack_1');
  assert.equal(s.attackActionForStep(1),'attack_2');
  assert.equal(s.attackActionForStep(2),'attack_3');
}

state('idle', () => {}, 'idle');
state('run', s => { s.state = 'running'; s.player.body.velocity.x = 285; }, 'run');
state('jump', s => { s.state = 'rising'; s.player.body.blocked.down = false; s.player.body.velocity.y = -300; }, 'jump');
state('fall', s => { s.state = 'falling'; s.player.body.blocked.down = false; s.player.body.velocity.y = 300; }, 'fall');
state('landing', s => { s.landingStartedAt = 1100; s.landingEndsAt = 1280; }, 'land');
state('dodge', s => { s.state = 'rolling'; }, 'dash');
state('combo attack 1', s => { s.state = 'attack-1'; s.comboStep = 0; }, 'attack_1');
state('combo attack 2', s => { s.state = 'attack-2'; s.comboStep = 1; }, 'attack_2');
state('combo attack 3', s => { s.state = 'attack-3'; s.comboStep = 2; }, 'attack_3');
state('hit', s => { s.state = 'running'; s.hitAnimStartsAt = 1100; s.hitAnimEndsAt = 1520; }, 'hit');
state('death', s => { s.dead = true; s.hitAnimEndsAt = 9999; s.state = 'attack-3'; }, 'death');

state('hit priority over attack', s => { s.hitAnimEndsAt = 1500; s.state = 'attack-3'; s.comboStep = 2; }, 'hit');
state('attack priority over locomotion', s => { s.state = 'attack-2'; s.comboStep = 1; }, 'attack_2');

// Rapid triple-tap must preserve two buffered presses rather than collapsing
// them into the old single boolean queue. That guarantees a visible 1->2->3
// combo even when the player taps faster than the first animation duration.
{
  const s=scene({attackStartsAt:1000,attackEndsAt:1195,comboStep:0});
  s.queueAttack(1050);
  s.queueAttack(1070);
  assert.equal(s.queuedAttackCount,2);
  const started=[];
  s.startAttack=(time,step)=>{
    started.push(step);
    s.comboStep=step;
    s.attackStartsAt=time;
    s.attackEndsAt=time+100;
  };
  assert.equal(s.finishOrChainAttack(1195),true);
  assert.equal(started[0],1);
  assert.equal(s.queuedAttackCount,1);
  assert.equal(s.finishOrChainAttack(1295),true);
  assert.equal(started[1],2);
  assert.equal(s.queuedAttackCount,0);
}

// A complete reversal uses all intermediate rotations across the two arcs while
// gameplay facing changes immediately.
{
  const s = scene({ facing: -1 });
  assert.equal(s.beginOrUpdateTurn('west', 1000), true);
  assert.equal(s.visualDirection, 'east');
  assert.equal(s.facing, -1);
  s.beginOrUpdateTurn('west', 1018); assert.equal(s.visualDirection, 'south-east');
  s.beginOrUpdateTurn('west', 1036); assert.equal(s.visualDirection, 'south');
  s.beginOrUpdateTurn('west', 1054); assert.equal(s.visualDirection, 'south-west');
  s.beginOrUpdateTurn('west', 1072); assert.equal(s.visualDirection, 'west');
  s.beginOrUpdateTurn('west', 1090); assert.equal(s.turning, false);
}
{
  const s = scene({ facing: 1, visualDirection: 'west', turnTargetDirection: 'west' });
  assert.equal(s.beginOrUpdateTurn('east', 2000), true);
  s.beginOrUpdateTurn('east', 2018); assert.equal(s.visualDirection, 'north-west');
  s.beginOrUpdateTurn('east', 2036); assert.equal(s.visualDirection, 'north');
  s.beginOrUpdateTurn('east', 2054); assert.equal(s.visualDirection, 'north-east');
  s.beginOrUpdateTurn('east', 2072); assert.equal(s.visualDirection, 'east');
  s.beginOrUpdateTurn('east', 2090); assert.equal(s.turning, false);
}

// Rapid reversal redirects the cosmetic turn immediately.
{
  const s = scene({ facing: -1 });
  s.beginOrUpdateTurn('west', 3000);
  s.beginOrUpdateTurn('west', 3018);
  assert.equal(s.visualDirection, 'south-east');
  s.facing = 1;
  s.beginOrUpdateTurn('east', 3020);
  assert.equal(s.turnTargetDirection, 'east');
  s.beginOrUpdateTurn('east', 3038);
  assert.equal(s.visualDirection, 'east');
  assert.equal(s.facing, 1);
}

// The three approved attack sequences line their readable contact frames up with
// the existing gameplay active windows. Gameplay durations are not retuned.
{
  const a1 = scene({ state: 'attack-1', comboStep: 0, attackStartsAt: 1000 });
  assert.equal(a1.attackFrame('attack_1', 'east', 1042), 2);
  assert.equal(a1.attackFrame('attack_1', 'east', 1122), 6);

  const a2 = scene({ state: 'attack-2', comboStep: 1, attackStartsAt: 1000 });
  assert.equal(a2.attackFrame('attack_2', 'east', 1048), 4);
  assert.equal(a2.attackFrame('attack_2', 'east', 1138), 6);

  const a3 = scene({ state: 'attack-3', comboStep: 2, attackStartsAt: 1000 });
  assert.equal(a3.attackFrame('attack_3', 'east', 1068), 4);
  assert.equal(a3.attackFrame('attack_3', 'east', 1190), 6);
}

// West landing has no supplied west animation; frame selection must still use
// the full nine-frame east sequence that the renderer mirrors at runtime.
{
  const s = scene({ landingStartedAt: 1000, landingEndsAt: 1180, facing: -1 });
  assert.equal(s.frameForState('land', 'west', 1180), 8);
}

// Death holds the new eight-frame sequence on its final approved frame.
{
  const s = scene({ dead: true, deathAnimStartsAt: 1000, pixelStateStartedAt: 1000 });
  assert.equal(s.frameForState('death', 'east', 5000), 7);
  assert.equal(s.frameForState('death', 'west', 9000), 7);
}

console.log('Latest protagonist scale, combo, grounding, and FX logic verification passed.');
