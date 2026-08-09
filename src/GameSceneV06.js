import { GameSceneV05 } from './GameSceneV05.js';
import { ENEMY1_MANIFEST } from './enemy1Manifest.js';

const ENEMY_DEATH_FPS = 12;
const ENEMY_DEATH_HOLD_MS = 180;
const ENEMY_DEATH_FADE_MS = 240;
const ENEMY_DEATH_Y_OFFSET = 18;

export class GameSceneV06 extends GameSceneV05 {
  killEnemy(enemy) {
    if (!enemy?.alive) return;

    const now = this.time.now;
    enemy.alive = false;
    enemy.state = 'dead';
    enemy.tell?.setVisible(false);
    enemy.hpBar?.setVisible(false);
    enemy.hpBarBg?.setVisible(false);

    this.tweens.killTweensOf(enemy.sprite);
    enemy.sprite.setAlpha(1).setAngle(0).setScale(1, 1).setVisible(true);
    if (enemy.sprite.body) {
      enemy.sprite.body.setVelocity(0, 0);
      enemy.sprite.body.enable = false;
    }

    if (ENEMY1_MANIFEST.death) {
      this.setEnemyAnim(enemy, 'death', now, true);
      const direction = enemy.facing < 0 ? 'west' : 'east';
      const frameCount = ENEMY1_MANIFEST.death?.[direction] || 1;
      enemy.deathEndsAt = now + Math.ceil(Math.max(0, frameCount - 1) / ENEMY_DEATH_FPS * 1000) + ENEMY_DEATH_HOLD_MS;
      enemy.deathFadeStarted = false;
    } else {
      enemy.deathEndsAt = now + ENEMY_DEATH_HOLD_MS;
      enemy.deathFadeStarted = false;
    }

    this.updateHud();
  }

  updateEnemy(enemy, time, index) {
    if (enemy?.state === 'dead') {
      if (ENEMY1_MANIFEST.death) {
        this.updateEnemyArt(enemy, time);
        if (enemy.sprite?.art) enemy.sprite.art.y += ENEMY_DEATH_Y_OFFSET;
      }

      if (!enemy.deathFadeStarted && time >= (enemy.deathEndsAt || 0)) {
        enemy.deathFadeStarted = true;
        this.tweens.add({
          targets: enemy.sprite,
          alpha: 0,
          duration: ENEMY_DEATH_FADE_MS,
          ease: 'Quad.easeOut',
          onComplete: () => enemy.sprite.setVisible(false)
        });
      }
      return;
    }

    super.updateEnemy(enemy, time, index);
  }

  update(time, delta) {
    super.update(time, delta);
    if (this.debug?.text) {
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.9.0 COMBAT POLISH', 'DARKBOUND v0.9.3 ENEMY DEATH ALIGN'));
    }
  }
}
