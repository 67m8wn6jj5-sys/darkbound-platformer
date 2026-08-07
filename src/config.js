export const TUNING = Object.freeze({
  runSpeed: 285,
  groundAcceleration: 2200,
  groundDrag: 2500,
  airAcceleration: 1200,
  airDrag: 300,
  jumpVelocity: -590,
  gravityY: 1450,
  fallGravityMultiplier: 1.7,
  lowJumpGravityMultiplier: 2.25,
  maxFallSpeed: 900,
  coyoteMs: 110,
  jumpBufferMs: 130,

  rollSpeed: 560,
  rollDurationMs: 380,
  rollCooldownMs: 680,

  comboResetMs: 520,
  attackDurationsMs: [230, 245, 330],
  attackActiveStartMs: [55, 65, 90],
  attackActiveEndMs: [145, 165, 230],
  attackRanges: [78, 84, 100],
  attackKnockback: [180, 220, 340],
  hitStopMs: [38, 45, 65],

  playerMaxHp: 5,
  playerInvulnMs: 900,

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
