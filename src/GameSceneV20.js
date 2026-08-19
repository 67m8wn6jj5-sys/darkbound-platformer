import { GameSceneV19 } from './GameSceneV19.js';
import { TUNING } from './config.js';
import { ENEMY1_MANIFEST } from './enemy1Manifest.js';

const VFX_RED=0xff3558;
const VFX_RED_HOT=0xff8a9b;
const VFX_WHITE=0xffffff;

export const COMBAT_V20=Object.freeze({
  melee:Object.freeze({
    attackTrigger:164,
    idealRange:116,
    retreatRange:70,
    verticalTolerance:102,
    windupMs:335,
    lungeMs:255,
    lungeSpeed:305,
    activeStartMs:78,
    activeEndMs:154,
    recoveryMs:325,
    cooldownMs:650,
    approachSpeedMin:76,
    retreatSpeed:94,
    staggerMs:Object.freeze([220,270,390]),
    groupCommitLockMs:300,
    dangerLaneAlpha:.16,
  }),
  encounter:Object.freeze({
    firstAttackDelayMs:650,
    enemyAttackSpacingMs:260,
  }),
  playerDamage:Object.freeze({
    overlayAlpha:.20,
    overlayFadeMs:260,
    tintMs:95,
    hpPulseMs:170,
    floatingTextMs:460,
  }),
});

export function chooseMeleeIntentV20(distance,verticalDistance,attackReady,groupReady=true){
  if(verticalDistance>COMBAT_V20.melee.verticalTolerance)return'hold';
  if(attackReady&&groupReady&&distance<=COMBAT_V20.melee.attackTrigger)return'windup';
  if(distance<COMBAT_V20.melee.retreatRange)return'retreat';
  if(distance>COMBAT_V20.melee.idealRange)return'approach';
  return'hold';
}

export function meleeContactIsValid(relativeX,verticalDistance,committedFor,attackRange){
  return relativeX>0&&
    relativeX<=attackRange&&
    verticalDistance<62&&
    committedFor>=COMBAT_V20.melee.activeStartMs&&
    committedFor<=COMBAT_V20.melee.activeEndMs;
}

export class GameSceneV20 extends GameSceneV19 {
  create(){
    super.create();
    this.meleeCommitLockedUntil=-Infinity;
    this.damageOverlay=this.add.rectangle(0,0,100,100,0x8f1028,0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1985)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.layoutDamageOverlay();
    this.scale.on('resize',()=>this.layoutDamageOverlay());
  }

  layoutDamageOverlay(){
    if(!this.damageOverlay)return;
    this.damageOverlay.setSize(this.scale.width,this.scale.height).setPosition(0,0);
  }

  loadRunNode(template,depth,transition=true){
    super.loadRunNode(template,depth,transition);
    const now=this.time.now;
    let combatIndex=0;
    for(const enemy of this.enemies||[]){
      if(!enemy?.alive||enemy.type==='boss1')continue;
      enemy.combatSlot=combatIndex;
      const typeDelay=enemy.type==='enemy2'?220:0;
      enemy.nextAttackAt=now+COMBAT_V20.encounter.firstAttackDelayMs+typeDelay+combatIndex*COMBAT_V20.encounter.enemyAttackSpacingMs;
      combatIndex++;
    }
  }

  clearMeleeDangerLane(enemy){
    if(!enemy?.dangerLane)return;
    this.tweens.killTweensOf(enemy.dangerLane);
    enemy.dangerLane.destroy?.();
    enemy.dangerLane=null;
  }

  createMeleeDangerLane(enemy){
    this.clearMeleeDangerLane(enemy);
    const facing=enemy.attackFacing||enemy.facing||1;
    const width=(enemy.attackRange||92)+20;
    const lane=this.add.rectangle(
      enemy.sprite.x+facing*width*.5,
      enemy.sprite.y-7,
      width,
      34,
      VFX_RED,
      COMBAT_V20.melee.dangerLaneAlpha
    ).setDepth(43).setStrokeStyle(2,VFX_RED_HOT,.70).setOrigin(.5);
    lane.setScale(.74,1);
    this.tweens.add({
      targets:lane,
      scaleX:1,
      alpha:COMBAT_V20.melee.dangerLaneAlpha+.10,
      duration:COMBAT_V20.melee.windupMs,
      ease:'Quad.easeIn'
    });
    enemy.dangerLane=lane;
  }

  beginMeleeWindup(enemy,time,dx){
    const body=enemy.sprite.body;
    enemy.state='windup';
    enemy.stateEndsAt=time+COMBAT_V20.melee.windupMs;
    enemy.attackFacing=dx<0?-1:1;
    enemy.facing=enemy.attackFacing;
    body.setVelocityX(0);
    enemy.tell.setVisible(true).setScale(.58).setAlpha(.22).setFillStyle(VFX_RED,.08).setStrokeStyle(3,VFX_RED_HOT,.96);
    this.tweens.killTweensOf(enemy.tell);
    this.tweens.add({targets:enemy.tell,scale:1.42,alpha:1,duration:COMBAT_V20.melee.windupMs,ease:'Quad.easeIn'});
    this.createMeleeDangerLane(enemy);
    this.meleeCommitLockedUntil=time+COMBAT_V20.melee.windupMs+COMBAT_V20.melee.lungeMs+COMBAT_V20.melee.groupCommitLockMs;
    this.setEnemyAnim(enemy,'patrol',time);
  }

  updateMeleeDangerLane(enemy){
    const lane=enemy?.dangerLane;
    if(!lane)return;
    const facing=enemy.attackFacing||enemy.facing||1;
    const width=(enemy.attackRange||92)+20;
    lane.setPosition(enemy.sprite.x+facing*width*.5,enemy.sprite.y-7);
  }

  updateMeleeEnemyV19(enemy,time,index){
    if(!enemy.alive||this.dead)return;
    const body=enemy.sprite.body;
    const dx=this.player.x-enemy.sprite.x;
    const dist=Math.abs(dx);
    const dy=Math.abs(this.player.y-enemy.sprite.y);
    const maxHp=enemy.maxHp||TUNING.enemyMaxHp;

    enemy.tell.setPosition(enemy.sprite.x,enemy.sprite.y-22);
    enemy.hpBarBg.setPosition(enemy.sprite.x,enemy.sprite.y-122);
    enemy.hpBar.setPosition(enemy.sprite.x-27,enemy.sprite.y-122).setSize(54*(enemy.hp/maxHp),3);

    if(enemy.state==='stagger'){
      this.clearMeleeDangerLane(enemy);
      enemy.tell.setVisible(false);
      body.velocity.x*=.68;
      this.setEnemyAnim(enemy,ENEMY1_MANIFEST.hit?'hit':'patrol',enemy.animStartedAt||time);
      if(time>=enemy.stateEndsAt){
        enemy.state='engage';
        enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,time+240);
        this.setEnemyAnim(enemy,'patrol',time,true);
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    if(enemy.state==='windup'){
      body.setVelocityX(0);
      enemy.facing=enemy.attackFacing||enemy.facing;
      this.updateMeleeDangerLane(enemy);
      if(time>=enemy.stateEndsAt){
        this.tweens.killTweensOf(enemy.tell);
        enemy.tell.setVisible(false);
        this.clearMeleeDangerLane(enemy);
        enemy.state='lunge';
        enemy.lungeStartedAt=time;
        enemy.stateEndsAt=time+COMBAT_V20.melee.lungeMs;
        enemy.attackDidHit=false;
        this.setEnemyAnim(enemy,ENEMY1_MANIFEST.lunge?'lunge':'patrol',time,true);
        body.setVelocityX(enemy.facing*COMBAT_V20.melee.lungeSpeed);
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    if(enemy.state==='lunge'){
      enemy.facing=enemy.attackFacing||enemy.facing;
      body.setVelocityX(enemy.facing*COMBAT_V20.melee.lungeSpeed);
      const committedFor=time-(enemy.lungeStartedAt||time);
      const relativeX=(this.player.x-enemy.sprite.x)*enemy.facing;
      if(!enemy.attackDidHit&&meleeContactIsValid(relativeX,dy,committedFor,enemy.attackRange||92)){
        enemy.attackDidHit=true;
        this.damagePlayer(time,enemy);
      }
      if(time>=enemy.stateEndsAt){
        body.setVelocityX(0);
        enemy.state='recovery';
        enemy.stateEndsAt=time+COMBAT_V20.melee.recoveryMs;
        enemy.nextAttackAt=time+COMBAT_V20.melee.cooldownMs;
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    if(enemy.state==='recovery'){
      body.velocity.x*=.62;
      if(time>=enemy.stateEndsAt){
        enemy.state='engage';
        this.setEnemyAnim(enemy,'patrol',time,true);
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    enemy.state='engage';
    enemy.facing=dx<0?-1:1;
    const groupReady=time>=(this.meleeCommitLockedUntil??-Infinity);
    const intent=chooseMeleeIntentV20(dist,dy,time>=enemy.nextAttackAt,groupReady);
    const separation=this.meleeSeparation(enemy);

    if(intent==='windup'){
      this.beginMeleeWindup(enemy,time,dx);
      this.updateEnemyArt(enemy,time);
      return;
    }

    let velocity=0;
    if(intent==='approach')velocity=enemy.facing*Math.max(COMBAT_V20.melee.approachSpeedMin,(enemy.speed||58)*1.28);
    else if(intent==='retreat')velocity=-enemy.facing*COMBAT_V20.melee.retreatSpeed;
    velocity+=separation;
    body.setVelocityX(velocity);
    this.setEnemyAnim(enemy,'patrol',time);
    this.updateEnemyArt(enemy,time);
  }

  showPlayerDamageFeedback(hpLost=1){
    if(this.damageOverlay){
      this.tweens.killTweensOf(this.damageOverlay);
      this.damageOverlay.setAlpha(COMBAT_V20.playerDamage.overlayAlpha);
      this.tweens.add({targets:this.damageOverlay,alpha:0,duration:COMBAT_V20.playerDamage.overlayFadeMs,ease:'Quad.easeOut'});
    }

    if(this.pixelArt){
      this.pixelArt.setTintFill(VFX_WHITE);
      this.time.delayedCall(COMBAT_V20.playerDamage.tintMs,()=>this.pixelArt?.clearTint?.());
    }

    if(this.hud){
      this.tweens.killTweensOf(this.hud);
      this.hud.setColor('#ff6f82').setScale(1.14);
      this.tweens.add({
        targets:this.hud,
        scale:1,
        duration:COMBAT_V20.playerDamage.hpPulseMs,
        ease:'Back.easeOut',
        onComplete:()=>this.hud?.setColor?.('#ffffff')
      });
    }

    const damageText=this.add.text(this.player.x,this.player.y-72,`-${hpLost} HP`,{
      fontFamily:'system-ui',fontSize:'20px',fontStyle:'bold',color:'#ff6f82',stroke:'#2a050b',strokeThickness:5
    }).setOrigin(.5).setDepth(127);
    this.tweens.add({
      targets:damageText,
      y:damageText.y-34,
      alpha:0,
      scale:1.12,
      duration:COMBAT_V20.playerDamage.floatingTextMs,
      ease:'Quad.easeOut',
      onComplete:()=>damageText.destroy()
    });

    const ring=this.add.circle(this.player.x,this.player.y-8,9,0xffffff,0)
      .setStrokeStyle(5,VFX_RED_HOT,.95)
      .setDepth(126)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:ring,scale:6.3,alpha:0,duration:210,ease:'Cubic.easeOut',onComplete:()=>ring.destroy()});
  }

  damagePlayer(time,enemy){
    if(this.isRollInvulnerable(time)){
      this.showDodgeFeedback(time,enemy);
      return;
    }
    const hpBefore=this.playerHp;
    super.damagePlayer(time,enemy);
    const lost=Math.max(0,hpBefore-this.playerHp);
    if(lost>0)this.showPlayerDamageFeedback(lost);
  }

  damageEnemy(enemy,step){
    if(!enemy?.alive)return;
    const hpBefore=enemy.hp;
    super.damageEnemy(enemy,step);
    if(enemy.hp>=hpBefore)return;

    const safeStep=Math.max(0,Math.min(2,Number(step)||0));
    if(enemy.alive&&enemy.type==='enemy1'){
      enemy.stateEndsAt=Math.max(enemy.stateEndsAt||0,this.time.now+COMBAT_V20.melee.staggerMs[safeStep]);
      enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,enemy.stateEndsAt+250);
    }

    const art=enemy.sprite?.art;
    if(art?.setTintFill){
      art.setTintFill(VFX_WHITE);
      this.time.delayedCall(safeStep===2?105:72,()=>art?.clearTint?.());
    }
  }

  killEnemy(enemy){
    if(enemy?.type==='enemy1')this.clearMeleeDangerLane(enemy);
    super.killEnemy(enemy);
  }

  destroyEnemyEntity(enemy){
    if(enemy?.type==='enemy1')this.clearMeleeDangerLane(enemy);
    super.destroyEnemyEntity(enemy);
  }

  killPlayer(){
    for(const enemy of this.enemies||[])this.clearMeleeDangerLane(enemy);
    super.killPlayer();
  }
}
