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
    this.worldWidth=2800;
    this.worldHeight=720;
    this.drawBackground();

    this.platforms=this.physics.add.staticGroup();
    this.addPlatform(0,640,2800,80);
    this.addPlatform(380,520,260,28);
    this.addPlatform(780,440,220,28);
    this.addPlatform(1160,550,300,28);
    this.addPlatform(1600,460,240,28);
    this.addPlatform(2050,370,260,28);
    this.addPlatform(2440,520,220,28);

    this.player=this.createPlayer(150,560);
    this.physics.add.collider(this.player,this.platforms);

    this.enemies=[
      this.createEnemy(700,560,'blade'),
      this.createEnemy(1420,500,'stalker')
    ];
    this.enemies.forEach(enemy=>this.physics.add.collider(enemy.sprite,this.platforms));

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
    this.attackQueued=false;
    this.attackHitIds=new Set();

    this.playerHp=TUNING.playerMaxHp;
    this.playerInvulnEndsAt=0;
    this.dead=false;

    this.attackFlash=this.add.rectangle(0,0,64,30,0xdce7ff,.28).setStrokeStyle(2,0xffffff,.95).setVisible(false).setDepth(50);
    this.attackArc=this.add.graphics().setVisible(false).setDepth(51);

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
    const far=this.add.graphics().setScrollFactor(.12);
    far.fillStyle(0x11162a,1);
    for(let x=0;x<this.worldWidth;x+=260){
      const h=120+((x/260)%3)*55;
      far.fillTriangle(x,640,x+160,640-h,x+320,640);
    }
    const mid=this.add.graphics().setScrollFactor(.35);
    mid.fillStyle(0x161b31,.9);
    for(let x=0;x<this.worldWidth;x+=190){
      mid.fillRect(x,470+(x%380?30:0),120,170);
    }
    const mist=this.add.graphics().setScrollFactor(.55).setAlpha(.3);
    mist.fillStyle(0x59618c,.22);
    for(let x=120;x<this.worldWidth;x+=420)mist.fillEllipse(x,590,280,42);
  }

  addPlatform(x,y,w,h){
    const r=this.add.rectangle(x+w/2,y+h/2,w,h,0x252b42).setStrokeStyle(2,0x4d587a);
    this.physics.add.existing(r,true);
    this.platforms.add(r);
  }

  createPlayer(x,y){
    const p=this.add.container(x,y);
    const shadow=this.add.ellipse(0,24,44,12,0x000000,.45);
    const cape=this.add.triangle(-4,5,-13,-19,-15,22,12,20,0x23795f,.95);
    const body=this.add.rectangle(0,-1,26,47,0x49d69f).setStrokeStyle(3,0xb9ffe2);
    const head=this.add.circle(0,-28,11,0x355f55).setStrokeStyle(2,0xb9ffe2);
    const eye=this.add.circle(6,-29,2.5,0xffffff);
    const sword=this.add.rectangle(19,2,28,5,0xcbd7e8).setOrigin(0,.5).setStrokeStyle(1,0xffffff);
    p.add([shadow,cape,body,head,eye,sword]);
    p.weapon=sword;
    p.cape=cape;
    this.physics.add.existing(p);
    p.body.setSize(28,54).setOffset(-14,-30).setCollideWorldBounds(true).setMaxVelocity(TUNING.rollSpeed,TUNING.maxFallSpeed);
    return p;
  }

  createEnemy(x,y,type){
    const sprite=this.add.container(x,y);
    const shadow=this.add.ellipse(0,22,42,11,0x000000,.45);
    const bodyColor=type==='stalker'?0x8d3e84:0xb94a67;
    const edgeColor=type==='stalker'?0xf2a5e6:0xffa0b6;
    const body=this.add.rectangle(0,0,type==='stalker'?28:32,48,bodyColor).setStrokeStyle(3,edgeColor);
    const hood=this.add.triangle(0,-28,-15,-10,0,-36,15,-10,type==='stalker'?0x57284f:0x6f273c,.95);
    const eye=this.add.circle(-7,-7,3,0xffeef6);
    const weapon=this.add.rectangle(-22,4,type==='stalker'?24:30,4,0xffb2c5).setOrigin(1,.5);
    sprite.add([shadow,body,hood,eye,weapon]);
    sprite.weapon=weapon;
    this.physics.add.existing(sprite);
    sprite.body.setSize(30,48).setOffset(-15,-24).setCollideWorldBounds(true).setMaxVelocity(190,TUNING.maxFallSpeed);

    const tell=this.add.circle(x,y,30,0xff304f,.10).setStrokeStyle(3,0xff5b72,.9).setVisible(false).setDepth(45);
    const hpBarBg=this.add.rectangle(x,y-48,38,5,0x140a12,.8).setDepth(44);
    const hpBar=this.add.rectangle(x-18,y-48,36,3,type==='stalker'?0xd977d0:0xff6f8d,1).setOrigin(0,.5).setDepth(45);

    return {
      id:`enemy-${x}-${type}`,
      type,
      sprite,
      tell,
      hpBarBg,
      hpBar,
      hp:TUNING.enemyMaxHp,
      alive:true,
      state:'chasing',
      stateEndsAt:0,
      nextAttackAt:type==='stalker'?500:0,
      speed:type==='stalker'?TUNING.enemySpeed*1.18:TUNING.enemySpeed,
      attackRange:type==='stalker'?TUNING.enemyAttackRange+12:TUNING.enemyAttackRange,
      windupMs:type==='stalker'?TUNING.enemyWindupMs-90:TUNING.enemyWindupMs
    };
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
      this.pausePanel.bg.setVisible(false);
      this.pausePanel.title.setVisible(false);
      this.touchControls.setVisible(true);
    } else {
      this.physics.pause();
      this.pausePanel.bg.setSize(this.scale.width,this.scale.height).setVisible(true);
      this.pausePanel.title.setPosition(this.scale.width/2,this.scale.height/2).setVisible(true);
      this.touchControls.setVisible(false);
      this.touchControls.pause.g.setVisible(true);
      this.touchControls.pause.t.setVisible(true);
      this.touchControls.pause.zone.setVisible(true);
    }
  }

  startAttack(time,step=null){
    const nextStep=step ?? (time<=this.comboExpiresAt?Math.min(this.comboStep+1,2):0);
    this.comboStep=nextStep;
    this.attackStartsAt=time;
    this.attackEndsAt=time+TUNING.attackDurationsMs[nextStep];
    this.comboExpiresAt=this.attackEndsAt+TUNING.comboResetMs;
    this.attackHitIds.clear();
    this.attackQueued=false;
    this.state=`attack-${nextStep+1}`;
    const angles=[-22,15,-38];
    this.player.weapon.setAngle(angles[nextStep]);
    this.tweens.add({targets:this.player.weapon,angle:nextStep===2?68:48,duration:TUNING.attackDurationsMs[nextStep]*.72,ease:'Quad.easeOut'});
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
    this.attackArc.setVisible(false);
    this.player.weapon.setAngle(0);
    return false;
  }

  updateAttack(time){
    const elapsed=time-this.attackStartsAt;
    const step=this.comboStep;
    const active=elapsed>=TUNING.attackActiveStartMs[step] && elapsed<=TUNING.attackActiveEndMs[step];
    const width=[64,72,92][step];
    const height=[28,34,44][step];
    const hitX=this.player.x+this.facing*(46+step*5);
    const hitY=this.player.y-2;
    this.attackFlash.setSize(width,height).setFillStyle(step===2?0xffe7a8:0xdce7ff,step===2?.34:.18).setVisible(active).setPosition(hitX,hitY);
    this.drawAttackArc(active,step);
    if(!active)return;

    const candidates=this.enemies
      .filter(enemy=>enemy.alive && !this.attackHitIds.has(enemy.id))
      .map(enemy=>({enemy,dx:(enemy.sprite.x-this.player.x)*this.facing,dy:Math.abs(enemy.sprite.y-this.player.y)}))
      .filter(entry=>entry.dx>0 && entry.dx<=TUNING.attackRanges[step] && entry.dy<64)
      .sort((a,b)=>a.dx-b.dx);

    const target=candidates[0]?.enemy;
    if(target){
      this.attackHitIds.add(target.id);
      this.damageEnemy(target,step);
    }
  }

  drawAttackArc(active,step){
    this.attackArc.clear();
    this.attackArc.setVisible(active);
    if(!active)return;
    const radius=[42,50,62][step];
    const start=this.facing>0?-0.75:Math.PI+0.75;
    const end=this.facing>0?0.7:Math.PI-0.7;
    this.attackArc.lineStyle(step===2?7:5,step===2?0xffe8a7:0xdce7ff,step===2?.72:.52);
    this.attackArc.beginPath();
    this.attackArc.arc(this.player.x,this.player.y-3,radius,start,end,this.facing<0);
    this.attackArc.strokePath();
  }

  applyHitStop(ms){
    if(this.physics.world.isPaused)return;
    this.physics.pause();
    this.time.delayedCall(ms,()=>{
      if(!this.dead && !this.pausePanel.bg.visible)this.physics.resume();
    });
  }

  damageEnemy(enemy,step){
    if(!enemy.alive)return;
    enemy.hp=Math.max(0,enemy.hp-1);
    enemy.state='stagger';
    enemy.stateEndsAt=this.time.now+135+(step*40);
    enemy.tell.setVisible(false);
    enemy.sprite.body.setVelocity(this.facing*TUNING.attackKnockback[step],step===2?-120:-60);
    this.cameras.main.shake(step===2?90:50,step===2?.006:.0032);
    this.tweens.add({targets:enemy.sprite,alpha:.18,yoyo:true,repeat:1,duration:52});
    this.spawnHitSparks(enemy.sprite.x,enemy.sprite.y-6,step);
    this.inputManager.rumble?.(step===2?85:45,step===2?.75:.42,step===2?.55:.25);
    this.applyHitStop(TUNING.hitStopMs[step]);
    if(enemy.hp<=0)this.killEnemy(enemy);
    this.updateHud();
  }

  spawnHitSparks(x,y,step){
    const count=step===2?8:5;
    for(let i=0;i<count;i++){
      const spark=this.add.rectangle(x,y,step===2?7:5,2,step===2?0xffe7a8:0xeaf1ff,.95).setDepth(70).setAngle((360/count)*i);
      const angle=(Math.PI*2/count)*i;
      const distance=(step===2?34:22)+(i%3)*6;
      this.tweens.add({targets:spark,x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance,alpha:0,scaleX:.2,duration:150+step*35,onComplete:()=>spark.destroy()});
    }
  }

  killEnemy(enemy){
    enemy.alive=false;
    enemy.state='dead';
    enemy.tell.setVisible(false);
    enemy.sprite.body.enable=false;
    enemy.hpBar.setVisible(false);
    enemy.hpBarBg.setVisible(false);
    this.spawnEnemyDeathEffect(enemy);
    this.tweens.add({targets:enemy.sprite,alpha:0,scaleX:1.35,scaleY:.55,duration:170,onComplete:()=>enemy.sprite.setVisible(false)});
  }

  spawnEnemyDeathEffect(enemy){
    const color=enemy.type==='stalker'?0xd77bd2:0xff7894;
    for(let i=0;i<9;i++){
      const shard=this.add.rectangle(enemy.sprite.x,enemy.sprite.y,5+(i%3)*2,5+(i%2)*3,color,.9).setDepth(60);
      const angle=(-Math.PI*.9)+(i/8)*Math.PI*1.8;
      const distance=38+(i%4)*12;
      this.tweens.add({targets:shard,x:shard.x+Math.cos(angle)*distance,y:shard.y+Math.sin(angle)*distance,alpha:0,angle:90+(i*35),duration:270+i*16,onComplete:()=>shard.destroy()});
    }
  }

  damagePlayer(time,enemy){
    if(this.dead || time<this.playerInvulnEndsAt || time<this.rollEndsAt)return;
    this.playerHp=Math.max(0,this.playerHp-TUNING.enemyAttackDamage);
    this.playerInvulnEndsAt=time+TUNING.playerInvulnMs;
    const away=this.player.x<enemy.sprite.x?-1:1;
    this.player.body.setVelocity(away*300,-285);
    this.cameras.main.shake(90,.006);
    this.tweens.add({targets:this.player,alpha:.18,yoyo:true,repeat:4,duration:75});
    this.spawnHitSparks(this.player.x,this.player.y-4,1);
    this.inputManager.rumble?.(120,.8,.65);
    this.updateHud();
    if(this.playerHp<=0)this.killPlayer();
  }

  killPlayer(){
    this.dead=true;
    this.state='dead';
    this.attackFlash.setVisible(false);
    this.attackArc.setVisible(false);
    this.enemies.forEach(enemy=>enemy.tell.setVisible(false));
    this.player.body.setVelocity(0,0);
    this.player.body.enable=false;
    this.deathPanel.bg.setSize(this.scale.width,this.scale.height).setVisible(true);
    this.deathPanel.title.setPosition(this.scale.width/2,this.scale.height/2).setVisible(true);
  }

  beginEnemyWindup(enemy,time,dx){
    enemy.state='windup';
    enemy.stateEndsAt=time+enemy.windupMs;
    enemy.sprite.body.setVelocityX(0);
    enemy.sprite.scaleX=dx<0?1:-1;
    enemy.tell.setPosition(enemy.sprite.x,enemy.sprite.y-2).setVisible(true).setScale(.65).setAlpha(.35);
    this.tweens.killTweensOf(enemy.tell);
    this.tweens.add({targets:enemy.tell,scale:1.38,alpha:.95,duration:enemy.windupMs,ease:'Quad.easeIn'});
    this.tweens.add({targets:enemy.sprite.weapon,angle:enemy.sprite.scaleX>0?-55:55,duration:enemy.windupMs*.8,ease:'Quad.easeIn'});
  }

  executeEnemyAttack(enemy,time){
    enemy.state='recovery';
    enemy.stateEndsAt=time+TUNING.enemyAttackRecoveryMs;
    enemy.nextAttackAt=time+TUNING.enemyAttackCooldownMs;
    enemy.tell.setVisible(false);
    const dx=this.player.x-enemy.sprite.x;
    const direction=Math.sign(dx)||1;
    enemy.sprite.body.setVelocityX(direction*(enemy.type==='stalker'?220:185));
    this.tweens.add({targets:enemy.sprite.weapon,angle:enemy.sprite.scaleX>0?45:-45,duration:90,yoyo:true});
    this.tweens.add({targets:enemy.sprite,scaleY:.86,yoyo:true,duration:95});
    if(Math.abs(dx)<=enemy.attackRange+18 && Math.abs(this.player.y-enemy.sprite.y)<58)this.damagePlayer(time,enemy);
  }

  updateEnemy(enemy,time,index){
    if(!enemy.alive || this.dead)return;
    const b=enemy.sprite.body;
    const dx=this.player.x-enemy.sprite.x;
    const distance=Math.abs(dx);

    enemy.tell.setPosition(enemy.sprite.x,enemy.sprite.y-2);
    enemy.hpBarBg.setPosition(enemy.sprite.x,enemy.sprite.y-48);
    enemy.hpBar.setPosition(enemy.sprite.x-18,enemy.sprite.y-48).setSize(36*(enemy.hp/TUNING.enemyMaxHp),3);

    if(enemy.state==='stagger'){
      if(time>=enemy.stateEndsAt)enemy.state='chasing';
      return;
    }
    if(enemy.state==='windup'){
      b.setVelocityX(0);
      if(time>=enemy.stateEndsAt)this.executeEnemyAttack(enemy,time);
      return;
    }
    if(enemy.state==='recovery'){
      b.velocity.x=moveTowards(b.velocity.x,0,10);
      if(time>=enemy.stateEndsAt){
        enemy.state='chasing';
        enemy.sprite.weapon.setAngle(0);
      }
      return;
    }

    const otherThreat=this.enemies.some((other,j)=>j!==index && other.alive && other.state==='windup' && Math.abs(other.sprite.x-this.player.x)<150);
    if(distance<=enemy.attackRange && time>=enemy.nextAttackAt && !otherThreat){
      this.beginEnemyWindup(enemy,time,dx);
      return;
    }

    if(distance<TUNING.enemyAggroRange){
      let direction=Math.sign(dx);
      const nearest=this.enemies.find((other,j)=>j!==index && other.alive && Math.abs(other.sprite.x-enemy.sprite.x)<58);
      if(nearest && Math.sign(nearest.sprite.x-enemy.sprite.x)===direction)direction*=-.35;
      b.setVelocityX(direction*enemy.speed);
      enemy.sprite.scaleX=dx<0?1:-1;
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
    const alive=this.enemies.filter(enemy=>enemy.alive).length;
    const hpSummary=this.enemies.map((enemy,i)=>enemy.alive?`E${i+1} ${enemy.hp}/${TUNING.enemyMaxHp}`:`E${i+1} ✓`).join('  ');
    this.hud?.setText(`HP ${this.playerHp}/${TUNING.playerMaxHp}   •   ${hpSummary}   •   ${alive} HOSTILE${alive===1?'':'S'}`);
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
    if(cmd.dodgePressed && grounded && canRoll)this.startRoll(time,b);

    const rolling=time<this.rollEndsAt;
    let attacking=time<this.attackEndsAt;
    if(cmd.attackPressed && !rolling){
      if(attacking)this.queueAttack(time);
      else this.startAttack(time);
      attacking=true;
    }

    if(attacking){
      this.updateAttack(time);
      attacking=this.finishOrChainAttack(time);
    } else {
      this.attackFlash.setVisible(false);
      this.attackArc.setVisible(false);
      if(time>this.comboExpiresAt)this.comboStep=0;
    }

    if(!rolling){
      const target=cmd.move*TUNING.runSpeed;
      const accel=grounded?TUNING.groundAcceleration:TUNING.airAcceleration;
      const movementScale=attacking?.48:1;
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

    this.player.cape.setScale(1,1+Math.min(.28,Math.abs(b.velocity.x)/900));
    if(!rolling && time>=this.rollEndsAt && this.player.alpha<1 && time>=this.playerInvulnEndsAt)this.player.setAlpha(1);
    this.player.scaleX=this.facing;
    this.enemies.forEach((enemy,index)=>this.updateEnemy(enemy,time,index));

    if(this.player.y>TUNING.respawnY){
      this.player.setPosition(150,540);
      b.setVelocity(0,0);
      this.playerHp=Math.max(1,this.playerHp-1);
      this.updateHud();
    }

    const enemyStates=this.enemies.map((enemy,i)=>`E${i+1}:${enemy.state}`).join(' ');
    this.cameras.main.followOffset.x=Phaser.Math.Linear(this.cameras.main.followOffset.x,-this.facing*95,.05);
    this.debug.setText(`DARKBOUND v0.4.0\nState: ${this.state}\nVelocity: ${Math.round(b.velocity.x)}, ${Math.round(b.velocity.y)}\nGrounded: ${grounded?'yes':'no'}\nInput: ${this.inputManager.lastSource}\n${enemyStates}\nController: ${this.inputManager.pad?'yes':'no'}`);
    this.updateHud();
  }
}
