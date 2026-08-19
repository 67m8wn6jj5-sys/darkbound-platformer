import { GameSceneV20 } from './GameSceneV20.js';
import { TUNING } from './config.js';

const VFX_GREEN_HOT=0xbfff8f;
const VFX_GREEN_CORE=0xf2ffe1;

export const COMBAT_V21=Object.freeze({
  swordPriority:Object.freeze({
    rearGracePx:8,
    rangeGracePx:10,
    verticalTolerance:66,
    clashRumbleMs:70,
    clashShakeMs:55,
  }),
});

export function swordPriorityContactIsValid(relativeX,verticalDistance,attackElapsed,step){
  const safeStep=Math.max(0,Math.min(2,Number(step)||0));
  const activeStart=TUNING.attackActiveStartMs[safeStep]||0;
  const activeEnd=TUNING.attackActiveEndMs[safeStep]||activeStart;
  const range=TUNING.attackRanges[safeStep]||0;
  return relativeX>=-COMBAT_V21.swordPriority.rearGracePx&&
    relativeX<=range+COMBAT_V21.swordPriority.rangeGracePx&&
    verticalDistance<COMBAT_V21.swordPriority.verticalTolerance&&
    attackElapsed>=activeStart&&
    attackElapsed<=activeEnd;
}

export class GameSceneV21 extends GameSceneV20 {
  playerSwordHasPriorityAgainst(enemy,time){
    if(!enemy?.alive||enemy.type!=='enemy1')return false;
    if(!this.state?.startsWith('attack-'))return false;
    if(!Number.isFinite(this.attackStartsAt))return false;

    const step=Math.max(0,Math.min(2,Number(this.comboStep)||0));
    const facing=this.facing<0?-1:1;
    const relativeX=(enemy.sprite.x-this.player.x)*facing;
    const verticalDistance=Math.abs(enemy.sprite.y-this.player.y);
    const attackElapsed=time-this.attackStartsAt;
    return swordPriorityContactIsValid(relativeX,verticalDistance,attackElapsed,step);
  }

  spawnSwordChargeClash(enemy,step){
    if(!enemy?.sprite||!this.player)return;
    const x=(this.player.x+enemy.sprite.x)*.5;
    const y=(this.player.y+enemy.sprite.y)*.5-12;
    const heavy=step===2;

    const ring=this.add.circle(x,y,7,0xffffff,0)
      .setStrokeStyle(heavy?6:5,VFX_GREEN_CORE,.98)
      .setDepth(130)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:ring,scale:heavy?7.2:5.8,alpha:0,duration:heavy?210:165,ease:'Cubic.easeOut',onComplete:()=>ring.destroy()});

    for(const angle of [-42,42]){
      const slash=this.add.rectangle(x,y,heavy?94:72,heavy?7:5,VFX_GREEN_HOT,.95)
        .setDepth(131)
        .setAngle(angle)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({targets:slash,scaleX:1.35,scaleY:.06,alpha:0,duration:heavy?150:115,ease:'Quad.easeOut',onComplete:()=>slash.destroy()});
    }

    this.cameras.main.shake(COMBAT_V21.swordPriority.clashShakeMs,heavy?.006:.0045);
    this.inputManager?.rumble?.(COMBAT_V21.swordPriority.clashRumbleMs,heavy?.66:.48,heavy?.38:.24);
  }

  interruptChargeWithSword(enemy,time){
    const step=Math.max(0,Math.min(2,Number(this.comboStep)||0));
    this.clearMeleeDangerLane(enemy);
    enemy.tell?.setVisible(false);
    this.tweens.killTweensOf(enemy.tell);

    const alreadyHit=this.attackHitIds?.has(enemy.id);
    if(!alreadyHit){
      this.attackHitIds?.add(enemy.id);
      this.damageEnemy(enemy,step);
    }else if(enemy.alive){
      enemy.state='stagger';
      enemy.stateEndsAt=Math.max(enemy.stateEndsAt||0,time+260+(step*55));
      enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,enemy.stateEndsAt+300);
      enemy.sprite?.body?.setVelocity?.(this.facing*(TUNING.attackKnockback[step]||225),step===2?-90:-35);
    }

    this.spawnSwordChargeClash(enemy,step);
    return true;
  }

  damagePlayer(time,enemy){
    const isCommittedMeleeCharge=enemy?.type==='enemy1'&&enemy.state==='lunge';
    if(isCommittedMeleeCharge&&this.playerSwordHasPriorityAgainst(enemy,time)){
      this.interruptChargeWithSword(enemy,time);
      return;
    }
    super.damagePlayer(time,enemy);
  }
}
