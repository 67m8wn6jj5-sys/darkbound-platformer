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

  comboResetMs: 650,
  attackDurationsMs: [195, 210, 540],
  attackActiveStartMs: [42, 48, 68],
  attackActiveEndMs: [122, 138, 190],
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