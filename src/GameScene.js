import { TUNING } from './config.js';
import { InputManager } from './InputManager.js';
import { TouchControls } from './TouchControls.js';

function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

export class GameScene extends Phaser.Scene {
  constructor(){super('GameScene');}

  create(){
    this.physics.world.gravity.y=TUNING.gravityY;
    this.worldWidth=2800; this.worldHeight=720;
    this.drawBackground();

    this.platforms=this.physics.add.staticGroup();
    this.addPlatform(0,640,2800,80);
    this.addPlatform(380,520,260,28); this.addPlatform(780,440,220,28); this.addPlatform(1160,550,300,28);
    this.addPlatform(1600,460,240,28); this.addPlatform(2050,370,260,28); this.addPlatform(2440,520,220,28);

    this.player=this.createPlayer(150,560);
    this.enemy=this.createEnemy(700,560);
    this.physics.add.collider(this.player,this.platforms);
    this.physics.add.collider(this.enemy,this.platforms);

    this.inputManager=new InputManager(this);
    this.touchControls=new TouchControls(this,this.inputManager);

    this.lastGroundedAt=0;
    this.jumpBufferedAt=-Infinity;
    this.facing=1;
    this.state='idle';
    this.lastRollAt=-Infinity;
    this.rollEndsAt=0;

    this.comboStep=0;
    this.comboExpiresAt=-Infinity;
    this.attackStartsAt=-Infinity;
    this.attackEndsAt=-Infinity;
    this.attackHitEnemy=false;
    this.attackQueued=false;

    this.playerHp=TUNING.playerMaxHp;
    this.playerInvulnEndsAt=0;
    this.enemyHp=TUNING.enemyMaxHp;
    this.enemyAlive=true;
    this.enemyState='chasing';
    this.enemyStateEndsAt=0;
    this.enemyNextAttackAt=0;
    this.dead=false;

    this.attackFlash=this.add.rectangle(0,0,64,30,0xdce7ff,.28).setStrokeStyle(2,0xffffff,.95).setVisible(false).setDepth(50);
    this.enemyTell=this.add.circle(0,0,30,0xff304f,.12).setStrokeStyle(3,0xff5b72,.95).setVisible(false).setDepth(45);

    this.cameras.main.setBounds(0,0,this.worldWidth,this.worldHeight).startFollow(this.player,true,.11,.16,80,70).setDeadzone(150,90);
    this.physics.world.setBounds(0,0,this.worldWidth,this.worldHeight+300);

    this.debug=this.add.text(18,18,'',{fontFamily:'monospace',fontSize:'13px',color:'#c7d0ff',backgroundColor:'#080b15bb',padding:{x:8,y:6}}).setScrollFactor(0).setDepth(900);
    this.hud=this.add.text(this.scale.width/2,20,'',{fontFamily:'system-ui',fontSize:'16px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#080b15cc',padding:{x:12,y:7}}).setOrigin(.5,0).setScrollFactor(0).setDepth(901);
    this.scale.on('resize',size=>this.hud.setPosition(size.width/2,20));

    this.pausePanel=this.createPausePanel();
    this.deathPanel=this.createDeathPanel();
    this.updateHud();
  }

  drawBackground(){
    this.cameras.main.setBackgroundColor('#070910');
    const far=this.add.graphics().setScrollFactor(.12); far.fillStyle(0x11162a,1);
    for(let x=0;x<this.worldWidth;x+=260){const h=120+((x/260)%3)*55; far.fillTriangle(x,640,x+160,640-h,x+320,640);}
    const mid=this.add.graphics().setScrollFactor(.35); mid.fillStyle(0x161b31,.9);
    for(let x=0;x<this.worldWidth;x+=190){mid.fillRect(x,470+(x%380?30:0),120,170);}
  }

  addPlatform(x,y,w,h){
    const r=this.add.rectangle(x+w/2,y+h/2,w,h,0x252b42).setStrokeStyle(2,0x4d587a);
    this.physics.add.existing(r,true);
    this.platforms.add(r);
  }

  createPlayer(x,y){
    const p=this.add.container(x,y);
    const shadow=this.add.ellipse(0,22,42,12,0x000000,.45);
    const body=this.add.rectangle(0,0,30,52,0x49d69f).setStrokeStyle(3,0xb9ffe2);
    const eye=this.add.circle(8,-8,3,0xffffff);
    p.add([shadow,body,eye]);
    this.physics.add.existing(p);
    p.body.setSize(28,50).setOffset(-14,-25).setCollideWorldBounds(true).setMaxVelocity(TUNING.rollSpeed,TUNING.maxFallSpeed);
    return p;
  }

  createEnemy(x,y){
    const e=this.add.container(x,y);
    const shadow=this.add.ellipse(0,21,40,11,0x000000,.45);
    const body=this.add.rectangle(0,0,32,48,0xb94a67).setStrokeStyle(3,0xffa0b6);
    const eye=this.add.circle(-8,-7,3,0xffe9ee);
    e.add([shadow,body,eye]);
    this.physics.add.existing(e);
    e.body.setSize(30,46).setOffset(-15,-23).setCollideWorldBounds(true).setMaxVelocity(180,TUNING.maxFallSpeed);
    return e;
  }

  createPausePanel(){
    const bg=this.add.rectangle(0,0,100,100,0x05060a,.88).setOrigin(0).setScrollFactor(0).setDepth(1200).setVisible(false);
    const title=this.add.text(0,0,'PAUSED\n\nTap pause, press Esc, or Start to resume',{align:'center',fontFamily:'system-ui',fontSize:'24px',color:'#ffffff'}).setOrigin(.5).setScrollFactor(0).setDepth(1201).setVisible(false);
    return {bg,title};
  }

  createDeathPanel(){
    const bg=this.add.rectangle(0,0,100,100,0x05060a,.9).setOrigin(0).setScrollFactor(0).setDepth(1300).setVisible(false);
    const title=this.add.text(0,0,'YOU DIED\n\nTap A or X to restart',{align:'center',fontFamily:'system-ui',fontSize:'28px',fontStyle:'bold',color:'#ffffff'}).setOrigin(.5).setScrollFactor(0).setDepth(1301).setVisible(false);
    return {bg,title};
  }

  togglePause(){
    if(this.dead)return;
    const paused=this.physics.world.isPaused;
    if(paused){
      this.physics.resume();
      this.pausePanel.bg.setVisible(false); this.pausePanel.title.setVisible(false);
      this.touchControls.setVisible(true);
    } else {
      this.physics.pause();
      this.pausePanel.bg.setSize(this.scale.width,this.scale.height).setVisible(true);
      this.pausePanel.title.setPosition(this.scale.width/2,this.scale.height/2).setVisible(true);
      this.touchControls.setVisible(false);
      this.touchControls.pause.g.setVisible(true); this.touchControls.pause.t.setVisible(true); this.touchControls.pause.zone.setVisible(true);
    }
  }

  startAttack(time, step=null){
    const nextStep=step ?? (time<=this.comboExpiresAt ? Math.min(this.comboStep+1,2) : 0);
    this.comboStep=nextStep;
    this.attackStartsAt=time;
    this.attackEndsAt=time+TUNING.attackDurationsMs[nextStep];
    this.comboExpiresAt=this.attackEndsAt+TUNING.comboResetMs;
    this.attackHitEnemy=false;
    this.attackQueued=false;
    this.state=`attack-${nextStep+1}`;
  }

  queueAttack(time){
    if(time>=this.attackStartsAt && time<=this.attackEndsAt+TUNING.attackInputBufferMs)this.attackQueued=true;
  }

  finishOrChainAttack(time){
    if(time<this.attackEndsAt)return true;
    if(this.attackQueued){
      this.startAttack(time,(this.comboStep+1)%3);
      return true;
    }
    this.attackFlash.setVisible(false);
    return false;
  }

  updateAttack(time){
    const elapsed=time-this.attackStartsAt;
    const step=this.comboStep;
    const active=elapsed>=TUNING.attackActiveStartMs[step] && elapsed<=TUNING.attackActiveEndMs[step];
    const width=[64,72,92][step];
    const height=[28,34,44][step];
    this.attackFlash.setSize(width,height).setFillStyle(step===2?0xffe7a8:0xdce7ff,step===2?.42:.28).setVisible(active).setPosition(this.player.x+this.facing*(46+step*5),this.player.y-2);
    if(!active || this.attackHitEnemy || !this.enemyAlive)return;

    const dx=(this.enemy.x-this.player.x)*this.facing;
    const dy=Math.abs(this.enemy.y-this.player.y);
    if(dx>0 && dx<=TUNING.attackRanges[step] && dy<62){
      this.attackHitEnemy=true;
      this.damageEnemy(step);
    }
  }

  applyHitStop(ms){
    if(this.physics.world.isPaused)return;
    this.physics.pause();
    this.time.delayedCall(ms,()=>{
      if(!this.dead && !this.pausePanel.bg.visible)this.physics.resume();
    });
  }

  damageEnemy(step){
    if(!this.enemyAlive)return;
    this.enemyHp=Math.max(0,this.enemyHp-1);
    this.enemyState='stagger';
    this.enemyStateEndsAt=this.time.now+140+(step*40);
    this.enemy.body.setVelocity(this.facing*TUNING.attackKnockback[step],step===2?-120:-60);
    this.cameras.main.shake(step===2?90:55,step===2?.006:.0035);
    this.tweens.add({targets:this.enemy,alpha:.18,yoyo:true,repeat:1,duration:55});
    this.applyHitStop(TUNING.hitStopMs[step]);

    if(this.enemyHp<=0)this.killEnemy();
    this.updateHud();
  }

  killEnemy(){
    this.enemyAlive=false;
    this.enemyState='dead';
    this.enemyTell.setVisible(false);
    this.enemy.body.enable=false;
    this.spawnEnemyDeathEffect();
    this.tweens.add({targets:this.enemy,alpha:0,scaleX:1.35,scaleY:.55,duration:170,onComplete:()=>this.enemy.setVisible(false)});
  }

  spawnEnemyDeathEffect(){
    for(let i=0;i<8;i++){
      const shard=this.add.rectangle(this.enemy.x,this.enemy.y,5+(i%3)*2,5+(i%2)*3,0xff7894,.9).setDepth(60);
      const angle=(-Math.PI*.9)+(i/7)*Math.PI*1.8;
      const distance=35+(i%4)*12;
      this.tweens.add({targets:shard,x:shard.x+Math.cos(angle)*distance,y:shard.y+Math.sin(angle)*distance,alpha:0,angle:90+(i*35),duration:260+i*18,onComplete:()=>shard.destroy()});
    }
  }

  damagePlayer(time){
    if(this.dead || time<this.playerInvulnEndsAt || time<this.rollEndsAt)return;
    this.playerHp=Math.max(0,this.playerHp-TUNING.enemyAttackDamage);
    this.playerInvulnEndsAt=time+TUNING.playerInvulnMs;
    const away=this.player.x<this.enemy.x?-1:1;
    this.player.body.setVelocity(away*300,-285);
    this.cameras.main.shake(90,.006);
    this.tweens.add({targets:this.player,alpha:.18,yoyo:true,repeat:4,duration:75});
    this.updateHud();
    if(this.playerHp<=0)this.killPlayer();
  }

  killPlayer(){
    this.dead=true;
    this.state='dead';
    this.attackFlash.setVisible(false);
    this.enemyTell.setVisible(false);
    this.player.body.setVelocity(0,0);
    this.player.body.enable=false;
    this.deathPanel.bg.setSize(this.scale.width,this.scale.height).setVisible(true);
    this.deathPanel.title.setPosition(this.scale.width/2,this.scale.height/2).setVisible(true);
  }

  beginEnemyWindup(time,dx){
    this.enemyState='windup';
    this.enemyStateEndsAt=time+TUNING.enemyWindupMs;
    this.enemy.body.setVelocityX(0);
    this.enemy.scaleX=dx<0?1:-1;
    this.enemyTell.setPosition(this.enemy.x,this.enemy.y-2).setVisible(true).setScale(.7).setAlpha(.4);
    this.tweens.add({targets:this.enemyTell,scale:1.35,alpha:.95,duration:TUNING.enemyWindupMs,ease:'Quad.easeIn'});
  }

  executeEnemyAttack(time){
    this.enemyState='recovery';
    this.enemyStateEndsAt=time+TUNING.enemyAttackRecoveryMs;
    this.enemyNextAttackAt=time+TUNING.enemyAttackCooldownMs;
    this.enemyTell.setVisible(false);
    const dx=this.player.x-this.enemy.x;
    const direction=Math.sign(dx)||1;
    this.enemy.body.setVelocityX(direction*185);
    this.tweens.add({targets:this.enemy,scaleX:this.enemy.scaleX*1.15,scaleY:.88,yoyo:true,duration:95});

    if(Math.abs(dx)<=TUNING.enemyAttackRange+18 && Math.abs(this.player.y-this.enemy.y)<56){
      this.damagePlayer(time);
    }
  }

  updateEnemy(time){
    if(!this.enemyAlive || this.dead)return;
    const b=this.enemy.body;
    const dx=this.player.x-this.enemy.x;
    const distance=Math.abs(dx);

    if(this.enemyState==='stagger'){
      if(time>=this.enemyStateEndsAt)this.enemyState='chasing';
      return;
    }

    if(this.enemyState==='windup'){
      b.setVelocityX(0);
      this.enemyTell.setPosition(this.enemy.x,this.enemy.y-2);
      if(time>=this.enemyStateEndsAt)this.executeEnemyAttack(time);
      return;
    }

    if(this.enemyState==='recovery'){
      b.velocity.x=moveTowards(b.velocity.x,0,10);
      if(time>=this.enemyStateEndsAt)this.enemyState='chasing';
      return;
    }

    if(distance<=TUNING.enemyAttackRange && time>=this.enemyNextAttackAt){
      this.beginEnemyWindup(time,dx);
      return;
    }

    if(distance<TUNING.enemyAggroRange){
      b.setVelocityX(Math.sign(dx)*TUNING.enemySpeed);
      this.enemy.scaleX=dx<0?1:-1;
    } else {
      b.velocity.x=moveTowards(b.velocity.x,0,8);
    }
  }

  startRoll(time,b){
    this.lastRollAt=time;
    this.rollEndsAt=time+TUNING.rollDurationMs;
    this.state='rolling';
    b.setVelocityX(this.facing*TUNING.rollSpeed);
    this.player.setAlpha(.55);
    this.tweens.add({targets:this.player,alpha:.25,yoyo:true,repeat:3,duration:55,onComplete:()=>this.player.setAlpha(1)});
  }

  updateHud(){
    const enemyText=this.enemyAlive?`${this.enemyHp}/${TUNING.enemyMaxHp}`:'DEFEATED';
    this.hud?.setText(`HP ${this.playerHp}/${TUNING.playerMaxHp}   •   ENEMY ${enemyText}   •   COMBO ${this.comboStep+1}`);
  }

  update(time,delta){
    const cmd=this.inputManager.update();

    if(this.dead){
      if(cmd.restartPressed)this.scene.restart();
      return;
    }

    if(cmd.pausePressed){this.togglePause();return;}
    if(this.physics.world.isPaused)return;

    const b=this.player.body;
    const grounded=b.blocked.down;
    if(grounded)this.lastGroundedAt=time;
    if(cmd.jumpPressed)this.jumpBufferedAt=time;
    if(cmd.move!==0)this.facing=Math.sign(cmd.move);

    const canRoll=time-this.lastRollAt>=TUNING.rollCooldownMs;
    if(cmd.dodgePressed&&grounded&&canRoll){
      this.startRoll(time,b);
    }

    const rolling=time<this.rollEndsAt;
    let attacking=time<this.attackEndsAt;

    if(cmd.attackPressed&&!rolling){
      if(attacking)this.queueAttack(time);
      else this.startAttack(time);
      attacking=true;
    }

    if(attacking){
      this.updateAttack(time);
      attacking=this.finishOrChainAttack(time);
    } else {
      this.attackFlash.setVisible(false);
      if(time>this.comboExpiresAt)this.comboStep=0;
    }

    if(!rolling){
      const target=cmd.move*TUNING.runSpeed;
      const accel=grounded?TUNING.groundAcceleration:TUNING.airAcceleration;
      const movementScale=attacking ? 0.48 : 1;
      b.velocity.x=moveTowards(b.velocity.x,target*movementScale,accel*delta/1000);
      if(cmd.move===0)b.velocity.x=moveTowards(b.velocity.x,0,(grounded?TUNING.groundDrag:TUNING.airDrag)*delta/1000);

      const coyote=time-this.lastGroundedAt<=TUNING.coyoteMs;
      const buffered=time-this.jumpBufferedAt<=TUNING.jumpBufferMs;
      if(buffered&&coyote){
        b.setVelocityY(TUNING.jumpVelocity);
        this.jumpBufferedAt=-Infinity;
        this.lastGroundedAt=-Infinity;
      }

      if(b.velocity.y<0&&!cmd.jumpHeld)b.velocity.y+=TUNING.gravityY*(TUNING.lowJumpGravityMultiplier-1)*delta/1000;
      else if(b.velocity.y>0)b.velocity.y+=TUNING.gravityY*(TUNING.fallGravityMultiplier-1)*delta/1000;
      b.velocity.y=Math.min(b.velocity.y,TUNING.maxFallSpeed);

      if(attacking)this.state=`attack-${this.comboStep+1}`;
      else this.state=grounded?(Math.abs(b.velocity.x)>15?'running':'idle'):(b.velocity.y<0?'rising':'falling');
    }

    if(!rolling && time>=this.rollEndsAt && this.player.alpha<1 && time>=this.playerInvulnEndsAt)this.player.setAlpha(1);
    this.player.scaleX=this.facing;
    this.updateEnemy(time);

    if(this.player.y>TUNING.respawnY){
      this.player.setPosition(150,540);
      b.setVelocity(0,0);
      this.playerHp=Math.max(1,this.playerHp-1);
      this.updateHud();
    }

    this.cameras.main.followOffset.x=Phaser.Math.Linear(this.cameras.main.followOffset.x,-this.facing*95,.05);
    this.debug.setText(`DARKBOUND v0.3.1\nState: ${this.state}\nVelocity: ${Math.round(b.velocity.x)}, ${Math.round(b.velocity.y)}\nGrounded: ${grounded?'yes':'no'}\nInput: ${this.inputManager.lastSource}\nEnemy: ${this.enemyState}\nController: ${this.inputManager.pad?'yes':'no'}`);
    this.updateHud();
  }
}
