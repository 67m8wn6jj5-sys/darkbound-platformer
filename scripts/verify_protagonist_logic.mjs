import assert from 'node:assert/strict';

globalThis.Phaser = { Scene: class Scene {} };
const { GameSceneV17 } = await import('../src/GameSceneV17.js');

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

state('idle', () => {}, 'idle');
state('run', s => { s.state = 'running'; s.player.body.velocity.x = 285; }, 'run');
state('jump', s => { s.state = 'rising'; s.player.body.blocked.down = false; s.player.body.velocity.y = -300; }, 'jump');
state('fall', s => { s.state = 'falling'; s.player.body.blocked.down = false; s.player.body.velocity.y = 300; }, 'fall');
state('landing', s => { s.landingStartedAt = 1100; s.landingEndsAt = 1280; }, 'land');
state('dodge', s => { s.state = 'rolling'; }, 'dash');
state('light attack', s => { s.state = 'attack-1'; s.comboStep = 0; }, 'light_attack');
state('heavy attack', s => { s.state = 'attack-3'; s.comboStep = 2; }, 'heavy_attack');
state('hit', s => { s.state = 'running'; s.hitAnimStartsAt = 1100; s.hitAnimEndsAt = 1520; }, 'hit');
state('death', s => { s.dead = true; s.hitAnimEndsAt = 9999; s.state = 'attack-3'; }, 'death');

// Priority: damage must beat attack/dodge/locomotion, attack must beat dodge,
// and dodge must beat airborne/locomotion.
state('hit priority over attack', s => { s.hitAnimEndsAt = 1500; s.state = 'attack-3'; s.comboStep = 2; }, 'hit');
state('attack priority over dodge', s => { s.state = 'attack-1'; }, 'light_attack');

// A 180-degree east->west reversal should visibly traverse the lower compass
// arc without changing gameplay facing. The reverse uses the upper arc, so all
// eight supplied directional rotations participate across the two turn paths.
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
  assert.equal(s.facing, -1);
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

// Rapid reversal in the middle of a visual turn must redirect from the current
// rotation pose rather than making gameplay wait for the first turn to finish.
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

// Existing gameplay active windows must line up with the approved weapon-impact
// portions of the new attack art.
{
  const light = scene({ state: 'attack-1', comboStep: 0, attackStartsAt: 1000 });
  assert.equal(light.attackFrame('light_attack', 'east', 1042), 1);
  assert.equal(light.attackFrame('light_attack', 'east', 1122), 5);

  const heavy = scene({ state: 'attack-3', comboStep: 2, attackStartsAt: 1000 });
  assert.equal(heavy.attackFrame('heavy_attack', 'east', 1068), 5);
  assert.equal(heavy.attackFrame('heavy_attack', 'east', 1190), 7);
}

// Death is a non-looping hold: after enough time the final frame remains set.
{
  const s = scene({ dead: true, deathAnimStartsAt: 1000, pixelStateStartedAt: 1000 });
  const a = s.frameForState('death', 'east', 5000);
  const b = s.frameForState('death', 'east', 9000);
  assert.equal(a, 12);
  assert.equal(b, 12);
}

console.log('Protagonist animation logic verification passed.');
