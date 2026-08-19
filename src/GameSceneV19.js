import { GameSceneV18 } from './GameSceneV18.js';
import { TUNING } from './config.js';
import { ENEMY1_MANIFEST } from './enemy1Manifest.js';
import { ENEMY2_MANIFEST } from './enemy2Manifest.js';

const VFX_GREEN=0x43ff57;
const VFX_GREEN_HOT=0xbfff8f;
const VFX_GREEN_CORE=0xf2ffe1;
const ROCK_SIZE=30;
const TROLL_ATTACK_FPS=12;

export const COMBAT_V19=Object.freeze({
  melee:Object.freeze({
    attackTrigger:172,
    idealRange:112,
    retreatRange:68,
    verticalTolerance:110,
    windupMs:285,
    lungeMs:310,
    lungeSpeed:330,
    activeDelayMs:72,
    recoveryMs:230,
    cooldownMs:520,
    approachSpeedMin:78,
    retreatSpeed:92,
    staggerMs:Object.freeze([175,215,285]),
  }),
  troll:Object.freeze({
    minRange:250,
    preferredRange:390,
    maxRange:650,
    verticalTolerance:220,
    aimMs:300,
    cooldownMs:1280,
    staggerCooldownMs:480,
    approachSpeed:54,
    retreatSpeed:84,
  }),
  encounter:Object.freeze({
    firstAttackDelayMs:520,
    enemyAttackSpacingMs:170,
  }),
  contactRecoil:Object.freeze([10,14,22]),
  dodgeFeedbackCooldownMs:120,
});

export function chooseMeleeIntent(distance,verticalDistance,attackReady){
  if(verticalDistance>COMBAT_V19.melee.verticalTolerance)return'hold';
  if(attackReady&&distance<=COMBAT_V19.melee.attackTrigger)return'windup';
  if(distance<COMBAT_V19.melee.retreatRange)return'retreat';
  if(distance>COMBAT_V19.melee.idealRange)return'approach';
  return'hold';
}

export function chooseTrollIntent(distance,verticalDistance,attackReady){
  if(verticalDistance>COMBAT_V19.troll.verticalTolerance)return'hold';
  if(distance<COMBAT_V19.troll.minRange)return'retreat';
  if(attackReady&&distance<=COMBAT_V19.troll.maxRange)return'aim';
  if(distance>COMBAT_V19.troll.preferredRange&&distance<COMBAT_V19.troll.maxRange+80)return'approach';
  return'hold';
}

export class GameSceneV19 extends GameSceneV18 {
  create(){
    super.create();
    this.lastDodgeFeedbackAt=-Infinity;
  }

  // V16 temporarily forced the werewolf immediately after room 1 for boss
  // testing. Combat Pass 1 restores the intended branching run while retaining
  // the boss as the final encounter later in the route.
  isBranchDepth(depth){
    return depth===0||depth===2;
  }

  loadRunNode(template,depth,transition=true){
    super.loadRunNode(template,depth,transition);
    const now=this.time.now;
    let combatIndex=0;
    for(const enemy of this.enemies||[]){
      if(!enemy?.alive||enemy.type==='boss1')continue;
      enemy.combatSlot=combatIndex;
      const typeDelay=enemy.type==='enemy2'?190:0;
      enemy.nextAttackAt=now+COMBAT_V19.encounter.firstAttackDelayMs+typeDelay+combatIndex*COMBAT_V19.encounter.enemyAttackSpacingMs;
      combatIndex++;
    }
  }

  meleeSeparation(enemy){
    let push=0;
    for(const other of this.enemies||[]){
      if(other===enemy||!other?.alive||other.type!=='enemy1'||other.roomDormant)continue;
      const dx=enemy.sprite.x-other.sprite.x;
      const dy=Math.abs(enemy.sprite.y-other.sprite.y);
      if(Math.abs(dx)<54&&dy<46)push+=(Math.sign(dx)||((enemy.combatSlot||0)%2?1:-1))*34;
    }
    return Math.max(-68,Math.min(68,push));
  }

  beginMeleeWindup(enemy,time,dx){
    const body=enemy.sprite.body;
    enemy.state='windup';
    enemy.stateEndsAt=time+COMBAT_V19.melee.windupMs;
    enemy.attackFacing=dx<0?-1:1;
    enemy.facing=enemy.attackFacing;
    body.setVelocityX(0);
    enemy.tell.setVisible(true).setScale(.62).setAlpha(.24).setFillStyle(0xff304f,.08).setStrokeStyle(3,0xff6b7d,.92);
    this.tweens.killTweensOf(enemy.tell);
    this.tweens.add({
      targets:enemy.tell,
      scale:1.34,
      alpha:.94,
      duration:COMBAT_V19.melee.windupMs,
      ease:'Quad.easeIn'
    });
    this.setEnemyAnim(enemy,'patrol',time);
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
      enemy.tell.setVisible(false);
      body.velocity.x*=.7;
      this.setEnemyAnim(enemy,ENEMY1_MANIFEST.hit?'hit':'patrol',enemy.animStartedAt||time);
      if(time>=enemy.stateEndsAt){
        enemy.state='engage';
        enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,time+180);
        this.setEnemyAnim(enemy,'patrol',time,true);
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    if(enemy.state==='windup'){
      body.setVelocityX(0);
      enemy.facing=enemy.attackFacing||enemy.facing;
      if(time>=enemy.stateEndsAt){
        this.tweens.killTweensOf(enemy.tell);
        enemy.tell.setVisible(false);
        enemy.state='lunge';
        enemy.lungeStartedAt=time;
        enemy.stateEndsAt=time+COMBAT_V19.melee.lungeMs;
        enemy.attackDidHit=false;
        this.setEnemyAnim(enemy,ENEMY1_MANIFEST.lunge?'lunge':'patrol',time,true);
        body.setVelocityX(enemy.facing*COMBAT_V19.melee.lungeSpeed);
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    if(enemy.state==='lunge'){
      enemy.facing=enemy.attackFacing||enemy.facing;
      body.setVelocityX(enemy.facing*COMBAT_V19.melee.lungeSpeed);
      const committedFor=time-(enemy.lungeStartedAt||time);
      if(!enemy.attackDidHit&&committedFor>=COMBAT_V19.melee.activeDelayMs&&dist<=enemy.attackRange+10&&dy<66){
        enemy.attackDidHit=true;
        this.damagePlayer(time,enemy);
      }
      if(time>=enemy.stateEndsAt){
        body.setVelocityX(0);
        enemy.state='recovery';
        enemy.stateEndsAt=time+COMBAT_V19.melee.recoveryMs;
        enemy.nextAttackAt=time+COMBAT_V19.melee.cooldownMs;
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    if(enemy.state==='recovery'){
      body.velocity.x*=.66;
      if(time>=enemy.stateEndsAt){
        enemy.state='engage';
        this.setEnemyAnim(enemy,'patrol',time,true);
      }
      this.updateEnemyArt(enemy,time);
      return;
    }

    enemy.state='engage';
    enemy.facing=dx<0?-1:1;
    const intent=chooseMeleeIntent(dist,dy,time>=enemy.nextAttackAt);
    const separation=this.meleeSeparation(enemy);

    if(intent==='windup'){
      this.beginMeleeWindup(enemy,time,dx);
      this.updateEnemyArt(enemy,time);
      return;
    }

    let velocity=0;
    if(intent==='approach')velocity=enemy.facing*Math.max(COMBAT_V19.melee.approachSpeedMin,(enemy.speed||58)*1.34);
    else if(intent==='retreat')velocity=-enemy.facing*COMBAT_V19.melee.retreatSpeed;
    velocity+=separation;
    body.setVelocityX(velocity);
    this.setEnemyAnim(enemy,'patrol',time);
    this.updateEnemyArt(enemy,time);
  }

  beginTrollAim(enemy,time,dx){
    enemy.state='aim';
    enemy.stateEndsAt=time+COMBAT_V19.troll.aimMs;
    enemy.attackFacing=dx<0?-1:1;
    enemy.facing=enemy.attackFacing;
    enemy.aimTargetX=this.player.x+(this.player?.body?.velocity?.x||0)*.10;
    enemy.aimTargetY=this.player.y;
    enemy.sprite.body.setVelocityX(0);
    enemy.tell.setVisible(true).setScale(.58).setAlpha(.22).setFillStyle(0xe8b45a,.07).setStrokeStyle(3,0xffd27a,.9);
    this.tweens.killTweensOf(enemy.tell);
    this.tweens.add({targets:enemy.tell,scale:1.28,alpha:.9,duration:COMBAT_V19.troll.aimMs,ease:'Quad.easeIn'});
    this.setTrollAnim(enemy,'patrol',time);
  }

  launchLockedTrollRock(enemy){
    const facing=enemy.attackFacing||enemy.facing||-1;
    const rock=this.physics.add.image(enemy.sprite.x+facing*18,enemy.sprite.y-25,'enemy2-rock').setDepth(105).setDisplaySize(ROCK_SIZE,ROCK_SIZE);
    rock.body.setCircle(ROCK_SIZE*.36).setAllowGravity(true);
    const targetX=Number.isFinite(enemy.aimTargetX)?enemy.aimTargetX:this.player.x;
    const targetY=Number.isFinite(enemy.aimTargetY)?enemy.aimTargetY:this.player.y;
    const dx=targetX-rock.x;
    const dy=(targetY-18)-rock.y;
    const flight=Phaser.Math.Clamp(Math.abs(dx)/420,.58,.92);
    const gravity=TUNING.gravityY;
    rock.setVelocity(Phaser.Math.Clamp(dx/flight,-450,450),(dy-.5*gravity*flight*flight)/flight);
    rock.setAngularVelocity(facing*520);

    const record={sprite:rock,alive:true};
    this.enemy2Projectiles=this.enemy2Projectiles||[];
    this.enemy2Projectiles.push(record);
    const destroy=()=>{
      if(!record.alive)return;
      record.alive=false;
      if(rock.active)rock.destroy();
    };

    this.physics.add.collider(rock,this.platforms,destroy);
    for(const gate of Object.values(this.roomGates||{}))this.physics.add.collider(rock,gate,destroy);
    for(const gate of this.progressionGates?.values?.()||[])this.physics.add.collider(rock,gate,destroy);
    this.physics.add.overlap(rock,this.player,()=>{
      if(!record.alive)return;
      this.damagePlayer(this.time.now,{sprite:rock,type:'projectile'});
      destroy();
    });
    this.time.delayedCall(2600,destroy);
  }

  updateEnemy2(enemy,time){
    if(enemy.state==='dead'){
      super.updateEnemy2(enemy,time);
      return;
    }
    if(!enemy.alive||this.dead)return;

    const body=enemy.sprite.body;
    const dx=this.player.x-enemy.sprite.x;
    const dist=Math.abs(dx);
    const dy=Math.abs(this.player.y-enemy.sprite.y);
    enemy.tell.setPosition(enemy.sprite.x,enemy.sprite.y-10);
    enemy.hpBarBg.setPosition(enemy.sprite.x,enemy.sprite.y-64);
    enemy.hpBar.setPosition(enemy.sprite.x-18,enemy.sprite.y-64).setSize(36*(enemy.hp/(enemy.maxHp||2)),3);

    if(enemy.state==='stagger'){
      enemy.tell.setVisible(false);
      body.velocity.x*=.72;
      if(ENEMY2_MANIFEST.hit)this.setTrollAnim(enemy,'hit',enemy.animStartedAt||time);
      else this.setTrollAnim(enemy,'patrol',time);
      if(time>=enemy.stateEndsAt){
        enemy.state='ranged';
        enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,time+COMBAT_V19.troll.staggerCooldownMs);
        this.setTrollAnim(enemy,'patrol',time,true);
      }
      this.updateTrollArt(enemy,time);
      return;
    }

    if(enemy.state==='aim'){
      body.setVelocityX(0);
      enemy.facing=enemy.attackFacing||enemy.facing;
      if(time>=enemy.stateEndsAt){
        this.tweens.killTweensOf(enemy.tell);
        enemy.tell.setVisible(false);
        enemy.state='attack';
        enemy.animStartedAt=time;
        enemy.rockReleased=false;
        this.setTrollAnim(enemy,'attack',time,true);
      }
      this.updateTrollArt(enemy,time);
      return;
    }

    if(enemy.state==='attack'){
      body.setVelocityX(0);
      enemy.facing=enemy.attackFacing||enemy.facing;
      const direction=enemy.facing<0?'west':'east';
      const count=ENEMY2_MANIFEST.attack?.[direction]||9;
      const duration=count/TROLL_ATTACK_FPS*1000;
      if(!enemy.rockReleased&&time-enemy.animStartedAt>=duration*.50){
        enemy.rockReleased=true;
        this.launchLockedTrollRock(enemy);
      }
      if(time-enemy.animStartedAt>=duration){
        enemy.state='ranged';
        enemy.nextAttackAt=time+COMBAT_V19.troll.cooldownMs;
        this.setTrollAnim(enemy,'patrol',time,true);
      }
      this.updateTrollArt(enemy,time);
      return;
    }

    enemy.state='ranged';
    enemy.facing=dx<0?-1:1;
    const intent=chooseTrollIntent(dist,dy,time>=enemy.nextAttackAt);
    if(intent==='aim'){
      this.beginTrollAim(enemy,time,dx);
      this.updateTrollArt(enemy,time);
      return;
    }
    if(intent==='retreat')body.setVelocityX(-enemy.facing*COMBAT_V19.troll.retreatSpeed);
    else if(intent==='approach')body.setVelocityX(enemy.facing*COMBAT_V19.troll.approachSpeed);
    else body.setVelocityX(0);
    this.setTrollAnim(enemy,'patrol',time);
    this.updateTrollArt(enemy,time);
  }

  updateEnemy(enemy,time,index){
    if(enemy?.type!=='enemy1'||enemy.roomDormant||enemy.state==='dead'||this.roomEncounter?.state==='inactive'){
      super.updateEnemy(enemy,time,index);
      return;
    }
    this.updateMeleeEnemyV19(enemy,time,index);
  }

  isRollInvulnerable(time){
    return !this.dead&&time<this.rollEndsAt;
  }

  showDodgeFeedback(time,enemy){
    if(time-(this.lastDodgeFeedbackAt??-Infinity)<COMBAT_V19.dodgeFeedbackCooldownMs)return;
    this.lastDodgeFeedbackAt=time;
    const ring=this.add.circle(this.player.x,this.player.y-4,9,0xffffff,0)
      .setStrokeStyle(3,VFX_GREEN_HOT,.95)
      .setDepth(124)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:ring,scale:4.6,alpha:0,duration:145,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});
    const threatX=enemy?.sprite?.x??(this.player.x-this.facing*30);
    const away=Math.sign(this.player.x-threatX)||-this.facing;
    for(let i=0;i<3;i++){
      const streak=this.add.rectangle(this.player.x-away*4,this.player.y-4+i*5,32+i*9,2,VFX_GREEN_CORE,.75)
        .setDepth(123).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({targets:streak,x:streak.x+away*(32+i*12),scaleX:1.5,scaleY:.1,alpha:0,duration:105+i*18,onComplete:()=>streak.destroy()});
    }
    this.inputManager?.rumble?.(28,.20,.08);
  }

  damagePlayer(time,enemy){
    if(this.isRollInvulnerable(time)){
      this.showDodgeFeedback(time,enemy);
      return;
    }
    super.damagePlayer(time,enemy);
  }

  spawnContactSlash(enemy,step){
    if(!enemy?.sprite)return;
    const heavy=step===2;
    const x=enemy.sprite.x-this.facing*(heavy?6:3);
    const y=enemy.sprite.y-(heavy?18:10);
    const slash=this.add.rectangle(x,y,heavy?82:58,heavy?6:4,VFX_GREEN_CORE,.92)
      .setDepth(122)
      .setAngle(this.facing>0?-16:16)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:slash,x:x+this.facing*(heavy?28:18),scaleX:1.38,scaleY:.08,alpha:0,duration:heavy?135:100,ease:'Quad.easeOut',onComplete:()=>slash.destroy()});
  }

  damageEnemy(enemy,step){
    if(!enemy?.alive)return;
    const hpBefore=enemy.hp;
    super.damageEnemy(enemy,step);
    if(enemy.hp>=hpBefore)return;

    const now=this.time.now;
    const safeStep=Math.max(0,Math.min(2,Number(step)||0));
    if(this.player?.body?.blocked?.down&&this.state?.startsWith('attack-')){
      this.player.body.velocity.x-=this.facing*COMBAT_V19.contactRecoil[safeStep];
    }

    if(enemy.alive&&enemy.type==='enemy1'){
      enemy.stateEndsAt=Math.max(enemy.stateEndsAt||0,now+COMBAT_V19.melee.staggerMs[safeStep]);
      enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,enemy.stateEndsAt+180);
    }else if(enemy.alive&&enemy.type==='enemy2'){
      enemy.nextAttackAt=Math.max(enemy.nextAttackAt||0,(enemy.stateEndsAt||now)+COMBAT_V19.troll.staggerCooldownMs);
    }

    this.spawnContactSlash(enemy,safeStep);
  }
}
