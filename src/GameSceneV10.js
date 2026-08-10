import { GameSceneV09 } from './GameSceneV09.js';
import { TUNING } from './config.js';

export class GameSceneV10 extends GameSceneV09 {
  updateAttack(time) {
    super.updateAttack(time);

    if (!this.enemy2Projectiles?.length) return;

    const step = this.comboStep;
    const elapsed = time - this.attackStartsAt;
    const active = elapsed >= TUNING.attackActiveStartMs[step] && elapsed <= TUNING.attackActiveEndMs[step];
    if (!active) return;

    const range = TUNING.attackRanges[step] + 18;
    const verticalReach = step === 2 ? 78 : 66;

    for (const projectile of this.enemy2Projectiles) {
      if (!projectile?.alive || !projectile.sprite?.active) continue;

      const dx = (projectile.sprite.x - this.player.x) * this.facing;
      const dy = Math.abs(projectile.sprite.y - (this.player.y - 6));
      if (dx <= 0 || dx > range || dy > verticalReach) continue;

      projectile.alive = false;
      const x = projectile.sprite.x;
      const y = projectile.sprite.y;
      projectile.sprite.destroy();

      this.spawnGreenBurst(x, y, step === 2 ? 18 : 11, step === 2 ? 42 : 30, step === 2 ? 32 : 24, 210);
      this.spawnCombatShockwave(x - this.facing * 4, y, step);
      this.cameras.main.shake(step === 2 ? 65 : 38, step === 2 ? .0045 : .0025);
      this.inputManager.rumble?.(step === 2 ? 55 : 32, step === 2 ? .5 : .3, .18);
    }
  }
}
