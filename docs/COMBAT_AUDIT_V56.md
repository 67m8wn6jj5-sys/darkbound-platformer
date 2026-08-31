# Darkbound Combat Audit — V56

Scope: live `main` runtime (`GameSceneV38` plus V48/V49/V51/V54/V55/V56 patches), player sword/roll/dash behavior, Enemy 1 melee, Enemy 2 projectile combat, boss combat, hit feedback, and CI coverage.

This audit intentionally makes **no gameplay changes**. It records current risks and the recommended implementation order before the next combat-polish pass.

## Executive summary

The combat foundation is functional and has several good systems already in place: attack-specific timing windows, combo buffering, directional Enemy 1 contact checks, melee charge interruption, roll invulnerability, projectile physics, stagger/knockback, hit stop, rumble, and animation-specific blade tracking.

The biggest remaining problem is that several gameplay hit rules are still inherited from prototype-era center/range checks and state timers while the visuals have become much more precise. There are also state-overlap bugs that can let attacks remain damaging while the player is rolling or visibly in hit-stun. Boss combat has two especially important fairness problems: the slam can damage a grounded player at any horizontal distance, and the lunge continuously re-aims while also lacking a true active contact window.

## Priority findings

### P0 — Attack hitbox remains active during dodge/roll

`GameScene.update()` starts a roll before it evaluates the already-running attack. If an attack is still inside `attackEndsAt`, `updateAttack()` continues to execute even though the player is now rolling.

Result:
- player can be roll-invulnerable and still have the sword hitbox active;
- V38 dash damage can overlap the sword damage during the same cancel;
- animation/state can read as dash while prototype sword contact logic is still live.

Required fix: define an explicit cancel policy. Recommended production behavior is to cancel the current sword hit window when a dodge begins, clear queued attack state, and make dash damage the only offensive contact during the dash.

### P0 — Sword damage continues while player is visibly in hit reaction

`GameSceneV05.damagePlayer()` starts the 420 ms hit animation, but it does not cancel `attackEndsAt`, clear the attack hit set, or end queued combo state. `resolvePixelState()` prioritizes `hit`, so the character can visibly recoil while `GameScene.updateAttack()` continues to run until the old attack timer expires.

Result: invisible/visually disconnected sword damage is possible after taking a hit.

Required fix: taking damage must cancel the current attack and queued combo unless a future explicit armor/super-armor mechanic says otherwise.

### P0 — Boss slam can damage the player anywhere as long as the player is grounded

`executeBossSlamLanding()` checks only `player.body.blocked.down` before calling `damagePlayer()`. It has no horizontal distance, vertical band, ground-surface, or shockwave-radius test.

Result: a grounded player can take damage with no spatial contact with the boss or visible shockwave.

Required fix: use an authored slam radius / ground shockwave region. Damage should require the player to be inside that region at the landing contact moment. Airborne players should remain safe.

### P0 — Boss lunge homes/reverses during the committed attack and has no authored active window

`updateBoss1()` recalculates `enemy.facing` from the player's current position every update, including while the boss is in `lunge`. The lunge velocity is then set from that facing. If the player crosses the boss, the boss can reverse direction during the committed lunge.

The lunge also damages whenever center distance is within `BOSS_HIT_RANGE` for the whole lunge state. Unlike Enemy 1, it has no active-start/active-end contact interval tied to the attack animation.

Required fix: lock `attackFacing` at windup completion, keep the lunge direction committed, and define a short active contact window mapped to the actual lunge frames.

### P0 — V38 dash can corrupt/cancel boss combat state

`updateDashDamageV38()` includes bosses unless `enemy.invulnerable` is truthy, but the boss entity does not define a normal invulnerability state. `damageEnemyWithDashV38()` then writes generic fields such as `enemy.state='stagger'` directly rather than routing through boss-specific damage logic.

Result:
- dash can interrupt a boss lunge/slam by replacing its state;
- boss hit behavior bypasses `GameSceneV15.damageEnemy()`;
- half-point dash damage and boss feedback are inconsistent with sword/relic combat.

Required fix: route dash contact through enemy-type-specific damage handling. Do not write generic Enemy 1 stagger state onto a boss.

## P1 — Hit geometry and timing polish

### Player sword hit test does not use the blade path that already exists

The live player attack test is still a forward center/range check:
- enemy center must be in front of `this.facing`;
- `dx <= TUNING.attackRanges[step]`;
- vertical center difference `< 64`.

Meanwhile V27/V29 already contains frame-authored blade root/tip positions for the visible sword. This means the project has enough data to make contact follow the actual blade, but the gameplay hit check does not use it.

Recommended fix: build a swept blade capsule/segment from previous tip/root to current tip/root for active frames, then test that against a compact enemy hurtbox. Keep small forgiveness padding so the result feels good on mobile.

### Sword-charge priority uses a second, separate approximation

V21 uses its own range/vertical test for sword priority against charging Enemy 1. That can disagree with the normal player sword hit result.

Recommended fix: one canonical `playerSwordContact(enemy, time)` geometry function should drive normal hits and charge clashes.

### Multi-target sword hits are frame-rate dependent

During an active update, `updateAttack()` sorts candidates and damages only `candidates[0]`. The next enemy can only be hit on a later update frame.

On a stable 60 fps device this can look like cleave. Under a frame drop, fewer enemies may be processed before the active window expires—especially because hit stop consumes scene time.

Recommended fix: evaluate all valid enemies for the current swept blade contact in the same logical combat step, with `attackHitIds` guaranteeing one hit per target per attack.

### Hit stop consumes attack/enemy timers and can lose buffered input

`applyHitStop()` pauses Arcade Physics, but attack and enemy states use absolute scene `time`. The main update returns while physics is paused, so the clock continues to advance while combat logic is skipped.

Consequences can include:
- active sword windows expiring during the freeze;
- combo input edges being missed during hit stop;
- enemy recovery/windup timers effectively shortening relative to visible/interactive time.

Recommended fix: implement combat hit stop as a controlled combat-time freeze or compensate the relevant state timestamps by the freeze duration. Input buffering should continue to capture button edges during hit stop.

## P1 — Damage/readability consistency

Player invulnerability lasts 850 ms, while the explicit hit animation lasts 420 ms and the inherited alpha flash is shorter than the full invulnerability period. There is a period where the character can look fully normal while still invulnerable.

Recommended fix: use a subtle production-quality invulnerability cue for the full protected interval, or deliberately shorten the invulnerability window after playtesting. Do not restore full-screen damage overlays.

Enemy 1 is in a better state than the boss: its facing is locked for the committed lunge, its hit is front-only, and V20 has a short 78–154 ms contact window. The main follow-up there is to validate that this window actually corresponds to the production lunge frames generated from `Enemy 1.zip`.

Enemy 2 projectile combat is structurally stronger because the rock uses a real physics circle/overlap and collides with terrain/gates. Its primary polish task is visual/contact validation rather than replacing the core hit model.

## P1 — CI currently gives false confidence about live combat

The combat verification pipeline is substantially stale relative to V56.

1. `verify_combat_v20.mjs` asserts that `main.js` contains `GameSceneV22` as proof that V22 is current. The live boot scene is V38; the regex can still pass because `GameSceneV22` appears in the inheritance comment.
2. `verify_combat_v20.mjs` verifies historical V20 danger-lane, full-screen damage overlay, and floating HP text source even though V35 intentionally suppresses those effects in the live game.
3. `inspect-protagonist.yml` browser smoke-checks V33/V32/V29 files but does not smoke-check the live V38 scene or V48/V49/V51/V54/V55/V56 runtime patches.
4. Enemy/boss manifests are generated only in the Pages build. Unit verification scripts create stub manifests, so current combat tests do not validate attack windows against the actual production animation frame counts.
5. There is no automated coverage for V38 dash damage, air dash, sword-vs-dash cancellation, hit-stun cancellation, boss slam radius, or boss lunge commitment.

Required fix: add a current-runtime combat verification layer that imports V38 plus all live patches, uses generated production manifests, and tests state transitions/contact functions directly.

## P2 — Architecture cleanup after behavior is correct

Combat behavior is spread across `GameScene.js`, V05, V15–V21, V25–V29, V35, V37, V38, and runtime patch files. That makes it easy for a later presentation override to preserve or accidentally revive prototype behavior.

After the P0/P1 fixes are validated, consolidate combat constants and pure contact functions into a small combat module (or a clearly designated current combat scene layer). Keep rendering/VFX separate from damage decisions.

## Recommended implementation order

1. Fix player state exclusivity: hit cancels attack; dodge cancels attack; no simultaneous sword+dash contact.
2. Fix boss fairness: slam spatial radius, committed lunge facing, authored lunge active window.
3. Route V38 dash through type-safe damage handling; explicitly define boss dash behavior.
4. Replace player sword center/range checks with V27/V29 blade-swept contact geometry.
5. Make sword priority call the same canonical contact function.
6. Rework hit-stop timing/input buffering so freezes do not consume gameplay windows.
7. Add live V38/V56 combat tests and production-manifest timing validation.
8. Playtest/tune numeric windows only after geometry/state correctness is stable.

## Acceptance criteria for the next combat pass

- A player cannot deal sword damage while visually rolling or recoiling from damage.
- Dodge-cancel behavior is explicit and deterministic.
- Sword contact occurs where the visible blade travels, with modest forgiveness only.
- Charge clashes and normal sword hits use the same contact model.
- Enemy 1 cannot damage from behind or outside its visible active strike.
- Boss lunge cannot reverse after commitment and only damages during authored contact frames.
- Boss slam cannot damage a distant grounded player.
- Dash cannot silently overwrite boss state.
- Hit stop does not shorten active/recovery windows or discard buffered attack input.
- Current CI tests the actual V38 + live patch runtime instead of historical source presence.
