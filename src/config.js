export const TUNING = Object.freeze({
  runSpeed: 285,
  groundAcceleration: 2200,
  groundDrag: 2500,
  airAcceleration: 1200,
  airDrag: 300,
  // V60: the cathedral's first intended route ledge is 128 px above the entry
  // floor. -590 only yielded ~120 px of full-hold rise at 1450 gravity, making
  // that route unreachable. -700 yields ~169 px while the existing low-jump
  // multiplier still preserves a short ~75 px tap/release hop.
  jumpVelocity: -700,
  gravityY: 1450,
  fallGravityMultiplier: 1.7,
  lowJumpGravityMultiplier: 2.25,
  maxFallSpeed: 900,
  coyoteMs: 110,
  jumpBufferMs: 130,

  rollSpeed: 560,
  rollDurationMs: 380,
  rollCooldownMs: 680,

  comboResetMs: 650,
  // V26: give the new 8/8/9-frame sword art enough time to read. The active
  // windows grow only modestly; most of the extra time is anticipation and
  // recovery so combat stays responsive instead of becoming floaty.
  attackDurationsMs: [230, 245, 500],
  attackActiveStartMs: [52, 60, 80],
  attackActiveEndMs: [144, 164, 220],
  attackRanges: [80, 88, 104],
  attackKnockback: [225, 285, 440],
  hitStopMs: [48, 58, 90],
  attackInputBufferMs: 150,

  playerMaxHp: 5,
  playerInvulnMs: 850,

  enemyMaxHp: 3,
  enemySpeed: 74,
  enemyAggroRange: 390,
  enemyAttackRange: 82,
  enemyWindupMs: 520,
  enemyAttackRecoveryMs: 720,
  enemyAttackCooldownMs: 1150,
  enemyAttackDamage: 1,

  respawnY: 900
});
