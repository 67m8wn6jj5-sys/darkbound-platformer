import { GameSceneV38 } from './GameSceneV38.js';
import {
  COMBAT_V58,
  cancelPlayerAttackV58,
  bossSlamCanHitV58,
  bossLungeCanHitV58,
} from './combatRulesV58.js';

// V58 is the first implementation pass from the V56 combat audit. It fixes the
// five P0 correctness/fairness issues before we replace sword geometry:
//   - dodge/air-dash immediately cancels any sword hit window and queued combo;
//   - taking real damage cancels the current sword attack;
//   - boss slam damage is spatial instead of global-to-all-grounded-players;
//   - boss lunge commits to one direction and has a short active contact window;
//   - dash damage never writes the generic `stagger` state onto the boss.
//
// Presentation is intentionally untouched. V57 remains the protagonist visual
// baseline while V58 changes only combat state/contact behavior.

const VERSION='v58-combat-correctness-20260903-1';
export const V58_CACHE_BUST=VERSION;

const BOSS_SPEED=72;
const BOSS_LUNGE_SPEED=430;
const BOSS_LUNGE_MS=360;
const BOSS_SLAM_JUMP_Y=-700;
const BOSS_SLAM_TRACK_SPEED=155;
const BOSS_SLAM_DOWN_SPEED=880;
const BOSS_RECOVERY=520;
const BOSS_COOLDOWN=850;

// One offensive state at a time. This wrapper catches both grounded rolls from
// the inherited GameScene update and V38's air-dash path.
const previousStartRoll=GameSceneV38.prototype.startRoll;
GameSceneV38.prototype.startRoll=function(time,body){
  cancelPlayerAttackV58(this);
  return previousStartRoll.call(this,time,body);
};

// Only a damage event that actually reduced HP cancels the sword. Invulnerable
// or roll-protected contacts leave state untouched.
const previousDamagePlayer=GameSceneV38.prototype.damagePlayer;
GameSceneV38.prototype.damagePlayer=function(time,enemy){
  const before=Number(this.playerHp)||0;
  const result=previousDamagePlayer.call(this,time,enemy);
  if((Number(this.playerHp)||0)<before)cancelPlayerAttackV58(this);
  return result;
};

// Ground slam now has a real shockwave region. A grounded player on the other
// side of the room—or standing on a vertically separate platform—is safe.
GameSceneV38.prototype.executeBossSlamLanding=function(enemy,time){
  if(enemy?.slamDidLand)return;
  enemy.slamDidLand=true;
  enemy.sprite?.body?.setVelocity?.(0,0);
  enemy.tell?.setVisible?.(false);
  this.setBossState?.(enemy,'slamRecover',time,BOSS_RECOVERY+160);

  this.cameras?.main?.shake?.(230,.012);
  this.spawnCombatShockwave?.(enemy.sprite?.x||0,(enemy.sprite?.y||0)+20,2);
  this.spawnGreenBurst?.(enemy.sprite?.x||0,(enemy.sprite?.y||0)+22,28,115,46,360);

  if(bossSlamCanHitV58(this.player,enemy))this.damagePlayer(time,enemy);
};

// Boss lunge keeps the established V15 behavior except for commitment/contact:
// facing is allowed to track during windup, then attackFacing is locked for the
// entire lunge. Damage is possible only during the authored middle strike window.
GameSceneV38.prototype.updateBoss1=function(enemy,time){
  if(enemy?.state==='dead'){
    this.updateBossArt?.(enemy,time);
    if(!enemy.deathFadeStarted&&time>=enemy.deathEndsAt){
      enemy.deathFadeStarted=true;
      this.tweens?.add?.({targets:enemy.sprite,alpha:0,duration:500,ease:'Quad.easeOut',onComplete:()=>enemy.sprite?.setVisible?.(false)});
    }
    return;
  }
  if(!enemy?.alive||this.dead)return;

  const body=enemy.sprite?.body;
  if(!body)return;
  const dx=this.player.x-enemy.sprite.x;
  const dist=Math.abs(dx);

  // Track normally except once the lunge has committed.
  if(enemy.state!=='lunge')enemy.facing=dx<0?-1:1;
  enemy.tell?.setPosition?.(enemy.sprite.x,enemy.sprite.y-34);

  if(enemy.state==='lungeWindup'){
    body.setVelocityX(0);
    if(time>=enemy.stateEndsAt){
      enemy.tell?.setVisible?.(false);
      enemy.attackFacing=enemy.facing<0?-1:1;
      enemy.facing=enemy.attackFacing;
      enemy.lungeStartedAt=time;
      this.setBossState?.(enemy,'lunge',time,BOSS_LUNGE_MS);
      enemy.attackDidHit=false;
      body.setVelocityX(enemy.attackFacing*BOSS_LUNGE_SPEED);
    }
    this.updateBossArt?.(enemy,time);return;
  }

  if(enemy.state==='lunge'){
    const committed=(Number(enemy.attackFacing)||Number(enemy.facing)||1)<0?-1:1;
    enemy.attackFacing=committed;
    enemy.facing=committed;
    body.setVelocityX(committed*BOSS_LUNGE_SPEED);
    const elapsed=Math.max(0,time-(Number(enemy.lungeStartedAt)||time));
    if(!enemy.attackDidHit&&bossLungeCanHitV58(this.player,enemy,elapsed)){
      enemy.attackDidHit=true;
      this.damagePlayer(time,enemy);
    }
    if(time>=enemy.stateEndsAt){
      body.setVelocityX(0);
      enemy.attackFacing=0;
      this.setBossState?.(enemy,'recover',time,BOSS_RECOVERY);
      enemy.nextAttackAt=time+BOSS_COOLDOWN;
    }
    this.updateBossArt?.(enemy,time);return;
  }

  if(enemy.state==='slamWindup'){
    body.setVelocityX(0);
    if(time>=enemy.stateEndsAt){
      enemy.tell?.setVisible?.(false);
      enemy.wasAirborne=false;
      enemy.slamDidLand=false;
      this.setBossState?.(enemy,'slamRise',time);
      body.setVelocity(enemy.facing*BOSS_SLAM_TRACK_SPEED,BOSS_SLAM_JUMP_Y);
    }
    this.updateBossArt?.(enemy,time);return;
  }

  if(enemy.state==='slamRise'){
    enemy.wasAirborne=enemy.wasAirborne||!body.blocked.down||body.velocity.y<0;
    const targetDir=Math.sign(this.player.x-enemy.sprite.x)||enemy.facing;
    body.setVelocityX(targetDir*BOSS_SLAM_TRACK_SPEED);
    if(body.velocity.y>=10){
      this.setBossState?.(enemy,'slamFall',time);
      body.setVelocityY(BOSS_SLAM_DOWN_SPEED);
    }
    this.updateBossArt?.(enemy,time);return;
  }

  if(enemy.state==='slamFall'){
    enemy.wasAirborne=true;
    body.setVelocityY(BOSS_SLAM_DOWN_SPEED);
    body.velocity.x*=.94;
    if(body.blocked.down&&enemy.wasAirborne)this.executeBossSlamLanding(enemy,time);
    this.updateBossArt?.(enemy,time);return;
  }

  if(enemy.state==='slamRecover'||enemy.state==='recover'){
    body.velocity.x*=.8;
    if(time>=enemy.stateEndsAt){
      this.setBossState?.(enemy,'idle',time);
      enemy.nextAttackAt=time+BOSS_COOLDOWN;
    }
    this.updateBossArt?.(enemy,time);return;
  }

  if(time>=enemy.nextAttackAt){
    enemy.attackCycle++;
    if(enemy.attackCycle%2===0)this.beginBossSlam?.(enemy,time);
    else this.beginBossLunge?.(enemy,time);
    this.updateBossArt?.(enemy,time);return;
  }

  if(dist>190)body.setVelocityX(enemy.facing*BOSS_SPEED);
  else body.setVelocityX(0);
  this.setBossAnim?.(enemy,'idle',time);
  this.updateBossArt?.(enemy,time);
};

// Non-boss dash behavior remains unchanged. Boss dash contact gets the same .5
// chip damage but does not mutate the boss attack state or route through generic
// Enemy-1 stagger logic.
const previousDashDamage=GameSceneV38.prototype.damageEnemyWithDashV38;
GameSceneV38.prototype.damageEnemyWithDashV38=function(enemy){
  if(enemy?.type!=='boss1')return previousDashDamage.call(this,enemy);
  if(!enemy?.alive||this.v38DashHitIds?.has?.(enemy.id))return;

  this.v38DashHitIds?.add?.(enemy.id);
  enemy.hp=Math.max(0,(Number(enemy.hp)||0)-COMBAT_V58.dashDamage);
  if(enemy.sprite?.body?.velocity)enemy.sprite.body.velocity.x+=this.facing*62;
  this.tweens?.add?.({targets:enemy.sprite,alpha:.55,yoyo:true,repeat:1,duration:34});
  this.spawnGreenBurst?.(enemy.sprite?.x||0,(enemy.sprite?.y||0)-18,7,24,20,120);
  this.cameras?.main?.shake?.(40,.0018);
  this.inputManager?.rumble?.(38,.28,.16);
  this.updateBossHud?.();
  this.updateHud?.();
  if(enemy.hp<=0)this.killBoss1?.(enemy);
};

function setMarker(){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(marker)marker.textContent='V58 • COMBAT SAFE';
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  setMarker();
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  setMarker();
};
