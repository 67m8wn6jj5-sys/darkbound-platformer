import { GameSceneV06 } from './GameSceneV06.js';

const ROOM_LEFT = 430;
const ROOM_RIGHT = 1710;
const ROOM_GATE_Y = 500;
const ROOM_GATE_HEIGHT = 280;
const ROOM_TRIGGER_X = 470;
const ROOM_BANNER_MS = 850;

export class GameSceneV07 extends GameSceneV06 {
  create() {
    super.create();

    this.roomEncounter = {
      state: 'inactive',
      activatedAt: 0,
      clearPending: false,
      clearedAt: 0,
      enemies: [...this.enemies]
    };

    this.roomGates = {
      left: this.createEncounterGate(ROOM_LEFT),
      right: this.createEncounterGate(ROOM_RIGHT)
    };
    this.setEncounterGatesLocked(false);

    this.roomBanner = this.add.text(this.scale.width / 2, 78, '', {
      fontFamily: 'system-ui',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#080b15dd',
      padding: { x: 16, y: 8 }
    }).setOrigin(.5, 0).setScrollFactor(0).setDepth(950).setAlpha(0);

    this.scale.on('resize', size => this.roomBanner?.setPosition(size.width / 2, 78));
  }

  createEncounterGate(x) {
    const gate = this.add.rectangle(x, ROOM_GATE_Y, 24, ROOM_GATE_HEIGHT, 0x5f1726, .9)
      .setStrokeStyle(3, 0xff5b72, .9)
      .setDepth(80);
    this.physics.add.existing(gate, true);
    this.physics.add.collider(this.player, gate);
    this.enemies.forEach(enemy => this.physics.add.collider(enemy.sprite, gate));
    return gate;
  }

  setEncounterGatesLocked(locked) {
    for (const gate of Object.values(this.roomGates || {})) {
      gate.setVisible(locked);
      if (gate.body) gate.body.enable = locked;
      if (locked) {
        this.tweens.killTweensOf(gate);
        gate.setAlpha(.92).setScale(1, 1);
        this.tweens.add({
          targets: gate,
          alpha: .58,
          scaleX: 1.18,
          yoyo: true,
          repeat: -1,
          duration: 260,
          ease: 'Sine.easeInOut'
        });
      } else {
        this.tweens.killTweensOf(gate);
        gate.setAlpha(.9).setScale(1, 1);
      }
    }
  }

  showRoomBanner(text, duration = ROOM_BANNER_MS) {
    if (!this.roomBanner) return;
    this.tweens.killTweensOf(this.roomBanner);
    this.roomBanner.setText(text).setAlpha(0).setScale(.92);
    this.tweens.add({
      targets: this.roomBanner,
      alpha: 1,
      scale: 1,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(duration, () => {
          if (!this.roomBanner) return;
          this.tweens.add({ targets: this.roomBanner, alpha: 0, duration: 220 });
        });
      }
    });
  }

  activateEncounter(time) {
    if (this.roomEncounter.state !== 'inactive') return;
    this.roomEncounter.state = 'combat';
    this.roomEncounter.activatedAt = time;
    this.setEncounterGatesLocked(true);
    this.showRoomBanner('ROOM SEALED');
    this.cameras.main.shake(90, .0035);

    for (const enemy of this.roomEncounter.enemies) {
      if (!enemy.alive) continue;
      enemy.state = 'patrol';
      enemy.nextAttackAt = time + 300;
      this.setEnemyAnim(enemy, 'patrol', time, true);
    }
  }

  clearEncounter(time) {
    if (this.roomEncounter.state !== 'combat') return;
    this.roomEncounter.state = 'cleared';
    this.roomEncounter.clearedAt = time;
    this.roomEncounter.clearPending = false;
    this.setEncounterGatesLocked(false);
    this.showRoomBanner('ROOM CLEARED', 1050);
    this.cameras.main.shake(120, .0025);
  }

  updateRoomEncounter(time) {
    const room = this.roomEncounter;
    if (!room) return;

    if (room.state === 'inactive') {
      if (this.player.x >= ROOM_TRIGGER_X && this.player.x < ROOM_RIGHT) this.activateEncounter(time);
      return;
    }

    if (room.state !== 'combat' || room.clearPending) return;

    const defeated = room.enemies.every(enemy => !enemy.alive);
    if (!defeated) return;

    room.clearPending = true;
    const latestDeathEnd = Math.max(time, ...room.enemies.map(enemy => enemy.deathEndsAt || time));
    const delay = Math.max(0, latestDeathEnd - time) + 120;
    this.time.delayedCall(delay, () => {
      if (this.roomEncounter?.state === 'combat') this.clearEncounter(this.time.now);
    });
  }

  updateEnemy(enemy, time, index) {
    if (this.roomEncounter?.state === 'inactive') {
      if (enemy?.alive && enemy.sprite?.body) {
        enemy.sprite.body.setVelocity(0, 0);
        enemy.state = 'dormant';
        this.setEnemyAnim(enemy, 'patrol', time);
        this.updateEnemyArt(enemy, time);
      }
      return;
    }

    super.updateEnemy(enemy, time, index);
  }

  update(time, delta) {
    super.update(time, delta);
    if (!this.player) return;

    this.updateRoomEncounter(time);

    if (this.debug?.text) {
      const roomState = this.roomEncounter?.state || 'none';
      this.debug.setText(
        this.debug.text
          .replace('DARKBOUND v0.9.0 COMBAT POLISH', 'DARKBOUND v0.10.0 ENCOUNTER ROOM')
          .replace('DARKBOUND v0.9.3 ENEMY DEATH ALIGN', 'DARKBOUND v0.10.0 ENCOUNTER ROOM') +
        `\nRoom: ${roomState}`
      );
    }
  }
}
