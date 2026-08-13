import { GameSceneV14 } from './GameSceneV14.js';
import { BOSS1_MANIFEST } from './boss1Manifest.js';

const BOSS1_ROOT='./assets/v05/boss1';
const BOSS_HP=12;
const BOSS_SCALE_HEIGHT=247;
const BOSS_ART_Y=72;
const BOSS_SPEED=72;
const BOSS_LUNGE_SPEED=430;
const BOSS_LUNGE_MS=360;
const BOSS_LUNGE_WINDUP=300;
const BOSS_SLAM_WINDUP=420;
const BOSS_SLAM_JUMP_Y=-700;
const BOSS_SLAM_TRACK_SPEED=155;
const BOSS_SLAM_DOWN_SPEED=880;
const BOSS_RECOVERY=520;
const BOSS_COOLDOWN=850;
const BOSS_HIT_RANGE=92;
const BOSS_IDLE_FPS=8;
const BOSS_ACTION_FPS=12;
const BOSS_DEATH_FPS=10;

const BOSS_TEMPLATE={
  id:'boss1',name:'THE MOON-BOUND',subtitle:'Werewolf boss',enemies:[],boss:true
};

const BOSS_LAYOUT={
  name:'MOON PIT',
  player:{x:560,y:560},
  platforms:[
    {x:760,y:510,w:220,h:24},
    {x:1220,y:510,w:220,h:24}
  ],
  spawns:[{x:1350,y:560}]
};

function bossKey(action,direction,index){
  return `boss1-${action}-${direction}-${String(index).padStart(3,'0')}`;
}

export class GameSceneV15 extends GameSceneV14 {
  preload(){
    super.preload();
    for(const [action,meta] of Object.entries(BOSS1_MANIFEST)){
      if(!meta||typeof meta!=='object')continue;
      for(const direction of ['east','west']){
        const count=meta?.[direction]||0;
        for(let i=0;i<count;i++){
          this.load.image(bossKey(action,direction,i),`${BOSS1_ROOT}/${action}/${direction}/frame_${String(i).padStart(3,'0')}.png?v=boss1-1`);
        }
      }
    }
  }

  create(){
    super.create();
    this.boss1=null;
    this.createBossHud();
  }

  singleNextTemplate(depth){
    if(depth===3)return BOSS_TEMPLATE;
    return super.singleNextTemplate(depth);
  }

  roomLayoutFor(template){
    if(template?.id==='boss1')return BOSS_LAYOUT;
    return super.roomLayoutFor(template);
  }

  loadRunNode(template,depth,transition=true){
    super.loadRunNode(template,depth,transition);
    this.setBossHudVisible(false);
    this.boss1=null;

    if(template?.id!=='boss1')return;

    const layout=this.roomLayoutFor(template);
    const spawn=layout.spawns[0];
    const boss=this.createBoss1(spawn.x,spawn.y);
    this.boss1=boss;
    this.enemies=[boss];
    if(this.rooms?.[0])this.rooms[0].enemies=[boss];
    this.physics.add.collider(boss.sprite,this.platforms);
    for(const gate of this.progressionGates?.values?.()||[])this.physics.add.collider(boss.sprite,gate);
    this.setBossHudVisible(true);
    this.updateBossHud();
    this.showRoomBanner('BOSS • THE MOON-BOUND',1400);
  }

  createBoss1(x,y){
    const sprite=this.add.container(x,y);
    const shadow=this.add.ellipse(0,28,88,18,0x000000,.5).setDepth(20);
    const art=this.add.image(0,BOSS_ART_Y,bossKey('idle','west',0)).setOrigin(.5,1).setDepth(21);
    if(art.height>0)art.setScale(BOSS_SCALE_HEIGHT/art.height);
    sprite.add([shadow,art]);
    sprite.art=art;
    sprite.weapon={setAngle(){return this;}};

    this.physics.add.existing(sprite);
    sprite.body.setSize(64,96).setOffset(-32,-56).setCollideWorldBounds(true).setMaxVelocity(520,1100);

    const tell=this.add.circle(x,y-34,62,0xff344f,.05).setStrokeStyle(3,0xff6a7e,.85).setVisible(false).setDepth(60);
    const hpBarBg=this.add.rectangle(x,y-150,110,7,0x13090d,.88).setDepth(61).setVisible(false);
    const hpBar=this.add.rectangle(x-53,y-150,106,4,0xff596f,1).setOrigin(0,.5).setDepth(62).setVisible(false);

    return {
      id:'boss1-moon-bound',type:'boss1',sprite,tell,hpBarBg,hpBar,
      hp:BOSS_HP,maxHp:BOSS_HP,alive:true,state:'idle',stateEndsAt:0,
      facing:-1,nextAttackAt:this.time.now+900,attackCycle:0,attackDidHit:false,
      animState:'idle',animStartedAt:this.time.now,wasAirborne:false,slamDidLand:false,
      deathEndsAt:0,deathFadeStarted:false
    };
  }

  createBossHud(){
    const depth=1000;
    const label=this.add.text(0,0,'THE MOON-BOUND',{
      fontFamily:'system-ui',fontSize:'12px',fontStyle:'bold',color:'#ffffff'
    }).setOrigin(.5,0).setScrollFactor(0).setDepth(depth).setVisible(false);
    const bg=this.add.rectangle(0,0,420,12,0x12080c,.9).setStrokeStyle(2,0x6f2636,.9).setScrollFactor(0).setDepth(depth).setVisible(false);
    const fill=this.add.rectangle(0,0,412,6,0xe24b64,1).setOrigin(0,.5).setScrollFactor(0).setDepth(depth+1).setVisible(false);
    this.bossHud={label,bg,fill};
    this.layoutBossHud();
    this.scale.on('resize',()=>this.layoutBossHud());
  }

  layoutBossHud(){
    if(!this.bossHud)return;
    const x=this.scale.width/2,y=54;
    this.bossHud.label.setPosition(x,y-22);
    this.bossHud.bg.setPosition(x,y);
    this.bossHud.fill.setPosition(x-206,y);
  }

  setBossHudVisible(visible){
    if(!this.bossHud)return;
    this.bossHud.label.setVisible(visible);
    this.bossHud.bg.setVisible(visible);
    this.bossHud.fill.setVisible(visible);
  }

  updateBossHud(){
    if(!this.bossHud||!this.boss1)return;
    const pct=Phaser.Math.Clamp(this.boss1.hp/this.boss1.maxHp,0,1);
    this.bossHud.fill.setDisplaySize(412*pct,6);
  }

  bossActionForState(state){
    if(state==='lunge'&&BOSS1_MANIFEST.lunge)return'lunge';
    if(state?.startsWith('slam')&&BOSS1_MANIFEST.slam)return'slam';
    if(state==='dead'&&BOSS1_MANIFEST.death)return'death';
    if(state==='hit'&&BOSS1_MANIFEST.hit)return'hit';
    return'idle';
  }

  setBossAnim(enemy,action,time,force=false){
    if(!BOSS1_MANIFEST[action])action='idle';
    if(!force&&enemy.animState===action)return;
    enemy.animState=action;
    enemy.animStartedAt=time;
  }

  setBossState(enemy,state,time,duration=0){
    enemy.state=state;
    enemy.stateEndsAt=duration?time+duration:0;
    this.setBossAnim(enemy,this.bossActionForState(state),time,true);
  }

  updateBossArt(enemy,time){
    if(!enemy?.sprite?.art)return;
    let action=enemy.animState||'idle';
    let meta=BOSS1_MANIFEST[action];
    if(!meta){action='idle';meta=BOSS1_MANIFEST.idle;}
    const direction=enemy.facing<0?'west':'east';
    const count=meta?.[direction]||1;
    const elapsed=Math.max(0,time-(enemy.animStartedAt||0));
    const looping=action==='idle';
    const fps=action==='death'?BOSS_DEATH_FPS:(looping?BOSS_IDLE_FPS:BOSS_ACTION_FPS);
    const frame=looping?Math.floor(elapsed/1000*fps)%count:Math.min(count-1,Math.floor(elapsed/1000*fps));
    const art=enemy.sprite.art;
    art.setTexture(bossKey(action,direction,frame)).setPosition(0,BOSS_ART_Y).setOrigin(.5,1);
    if(art.height>0)art.setScale(BOSS_SCALE_HEIGHT/art.height);
    art.setFlipX((direction==='west'&&!!meta.mirrorWest)||(direction==='east'&&!!meta.mirrorEast));
  }

  beginBossLunge(enemy,time){
    this.setBossState(enemy,'lungeWindup',time,BOSS_LUNGE_WINDUP);
    enemy.sprite.body.setVelocityX(0);
    enemy.tell.setVisible(true).setScale(.72).setAlpha(.25);
    this.tweens.killTweensOf(enemy.tell);
    this.tweens.add({targets:enemy.tell,scale:1.3,alpha:.9,duration:BOSS_LUNGE_WINDUP,ease:'Quad.easeIn'});
  }

  beginBossSlam(enemy,time){
    this.setBossState(enemy,'slamWindup',time,BOSS_SLAM_WINDUP);
    enemy.sprite.body.setVelocityX(0);
    enemy.tell.setVisible(true).setScale(.85).setAlpha(.3);
    this.tweens.killTweensOf(enemy.tell);
    this.tweens.add({targets:enemy.tell,scale:1.55,alpha:.95,duration:BOSS_SLAM_WINDUP,ease:'Quad.easeIn'});
    this.showRoomBanner('GROUND SLAM • JUMP!',520);
  }

  executeBossSlamLanding(enemy,time){
    if(enemy.slamDidLand)return;
    enemy.slamDidLand=true;
    enemy.sprite.body.setVelocity(0,0);
    enemy.tell.setVisible(false);
    this.setBossState(enemy,'slamRecover',time,BOSS_RECOVERY+160);

    this.cameras.main.shake(230,.012);
    this.spawnCombatShockwave(enemy.sprite.x,enemy.sprite.y+20,2);
    this.spawnGreenBurst(enemy.sprite.x,enemy.sprite.y+22,28,115,46,360);

    const playerGrounded=!!this.player?.body?.blocked?.down;
    if(playerGrounded)this.damagePlayer(time,enemy);
  }

  updateBoss1(enemy,time){
    if(enemy.state==='dead'){
      this.updateBossArt(enemy,time);
      if(!enemy.deathFadeStarted&&time>=enemy.deathEndsAt){
        enemy.deathFadeStarted=true;
        this.tweens.add({targets:enemy.sprite,alpha:0,duration:500,ease:'Quad.easeOut',onComplete:()=>enemy.sprite.setVisible(false)});
      }
      return;
    }
    if(!enemy.alive||this.dead)return;

    const body=enemy.sprite.body;
    const dx=this.player.x-enemy.sprite.x;
    const dist=Math.abs(dx);
    const dy=Math.abs(this.player.y-enemy.sprite.y);
    enemy.facing=dx<0?-1:1;
    enemy.tell.setPosition(enemy.sprite.x,enemy.sprite.y-34);

    if(enemy.state==='lungeWindup'){
      body.setVelocityX(0);
      if(time>=enemy.stateEndsAt){
        enemy.tell.setVisible(false);
        this.setBossState(enemy,'lunge',time,BOSS_LUNGE_MS);
        enemy.attackDidHit=false;
        body.setVelocityX(enemy.facing*BOSS_LUNGE_SPEED);
      }
      this.updateBossArt(enemy,time);return;
    }

    if(enemy.state==='lunge'){
      body.setVelocityX(enemy.facing*BOSS_LUNGE_SPEED);
      if(!enemy.attackDidHit&&dist<=BOSS_HIT_RANGE&&dy<90){
        enemy.attackDidHit=true;
        this.damagePlayer(time,enemy);
      }
      if(time>=enemy.stateEndsAt){
        body.setVelocityX(0);
        this.setBossState(enemy,'recover',time,BOSS_RECOVERY);
        enemy.nextAttackAt=time+BOSS_COOLDOWN;
      }
      this.updateBossArt(enemy,time);return;
    }

    if(enemy.state==='slamWindup'){
      body.setVelocityX(0);
      if(time>=enemy.stateEndsAt){
        enemy.tell.setVisible(false);
        enemy.wasAirborne=false;
        enemy.slamDidLand=false;
        this.setBossState(enemy,'slamRise',time);
        body.setVelocity(enemy.facing*BOSS_SLAM_TRACK_SPEED,BOSS_SLAM_JUMP_Y);
      }
      this.updateBossArt(enemy,time);return;
    }

    if(enemy.state==='slamRise'){
      enemy.wasAirborne=enemy.wasAirborne||!body.blocked.down||body.velocity.y<0;
      const targetDir=Math.sign(this.player.x-enemy.sprite.x)||enemy.facing;
      body.setVelocityX(targetDir*BOSS_SLAM_TRACK_SPEED);
      if(body.velocity.y>=10){
        this.setBossState(enemy,'slamFall',time);
        body.setVelocityY(BOSS_SLAM_DOWN_SPEED);
      }
      this.updateBossArt(enemy,time);return;
    }

    if(enemy.state==='slamFall'){
      enemy.wasAirborne=true;
      body.setVelocityY(BOSS_SLAM_DOWN_SPEED);
      body.velocity.x*=.94;
      if(body.blocked.down&&enemy.wasAirborne)this.executeBossSlamLanding(enemy,time);
      this.updateBossArt(enemy,time);return;
    }

    if(enemy.state==='slamRecover'||enemy.state==='recover'){
      body.velocity.x*=.8;
      if(time>=enemy.stateEndsAt){
        this.setBossState(enemy,'idle',time);
        enemy.nextAttackAt=time+BOSS_COOLDOWN;
      }
      this.updateBossArt(enemy,time);return;
    }

    if(time>=enemy.nextAttackAt){
      enemy.attackCycle++;
      if(enemy.attackCycle%2===0)this.beginBossSlam(enemy,time);
      else this.beginBossLunge(enemy,time);
      this.updateBossArt(enemy,time);return;
    }

    if(dist>190){
      body.setVelocityX(enemy.facing*BOSS_SPEED);
    }else{
      body.setVelocityX(0);
    }
    this.setBossAnim(enemy,'idle',time);
    this.updateBossArt(enemy,time);
  }

  updateEnemy(enemy,time,index){
    if(enemy?.type==='boss1'){
      this.updateBoss1(enemy,time);
      return;
    }
    super.updateEnemy(enemy,time,index);
  }

  damageEnemy(enemy,step){
    if(enemy?.type!=='boss1'){
      super.damageEnemy(enemy,step);
      return;
    }
    if(!enemy.alive)return;

    const baseDamage=1;
    const bonus=(this.runStats?.damage||0)+(step===2?(this.runStats?.heavyDamage||0):0);
    enemy.hp=Math.max(0,enemy.hp-baseDamage-bonus);
    enemy.sprite.body.velocity.x+=this.facing*(step===2?90:45);
    this.spawnImpactBurst?.(enemy.sprite.x,enemy.sprite.y-20,step);
    this.spawnCombatShockwave(enemy.sprite.x-this.facing*10,enemy.sprite.y-28,step);
    this.cameras.main.shake(step===2?95:50,step===2?.006:.003);
    this.inputManager.rumble?.(step===2?90:48,step===2?.72:.42,.28);
    this.applyHitStop(step===2?82:46);
    this.updateBossHud();
    this.updateHud();

    if(enemy.hp<=0)this.killBoss1(enemy);
  }

  killBoss1(enemy){
    if(!enemy?.alive)return;
    const now=this.time.now;
    enemy.alive=false;
    enemy.state='dead';
    enemy.tell.setVisible(false);
    enemy.sprite.body.setVelocity(0,0);
    enemy.sprite.body.enable=false;
    this.setBossAnim(enemy,BOSS1_MANIFEST.death?'death':'idle',now,true);
    const action=enemy.animState;
    const meta=BOSS1_MANIFEST[action];
    const dir=enemy.facing<0?'west':'east';
    const count=meta?.[dir]||1;
    enemy.deathEndsAt=now+Math.max(600,(count/BOSS_DEATH_FPS)*1000);
    enemy.deathFadeStarted=false;
    this.time.delayedCall(120,()=>this.setBossHudVisible(false));
    this.cameras.main.shake(260,.012);
    this.spawnGreenBurst(enemy.sprite.x,enemy.sprite.y-10,38,160,60,520);
    this.updateBossHud();
    this.updateHud();
  }

  updateEnemyHealthBars(){
    super.updateEnemyHealthBars();
    const enemy=this.boss1;
    if(!enemy?.sprite)return;
    enemy.hpBarBg?.setPosition(enemy.sprite.x,enemy.sprite.y-150).setVisible(enemy.alive);
    enemy.hpBar?.setPosition(enemy.sprite.x-53,enemy.sprite.y-150).setVisible(enemy.alive);
    if(enemy.alive)enemy.hpBar.setDisplaySize(106*Phaser.Math.Clamp(enemy.hp/enemy.maxHp,0,1),4);
  }

  update(time,delta){
    super.update(time,delta);
    if(this.boss1?.alive)this.updateBossHud();
  }
}
