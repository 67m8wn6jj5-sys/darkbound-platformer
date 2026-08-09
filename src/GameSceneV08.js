import { GameSceneV07 } from './GameSceneV07.js';
import { ENEMY2_MANIFEST } from './enemy2Manifest.js';
import { TUNING } from './config.js';

const ENEMY2_ROOT='./assets/v05/enemy2';
const TROLL_SCALE=.72;
const TROLL_ART_Y=34;
const TROLL_HP=2;
const TROLL_MIN_RANGE=230;
const TROLL_PREFERRED_RANGE=360;
const TROLL_MAX_RANGE=610;
const TROLL_SPEED=46;
const TROLL_ATTACK_FPS=12;
const TROLL_WALK_FPS=9;
const TROLL_HIT_FPS=12;
const TROLL_DEATH_FPS=10;
const TROLL_DEATH_HOLD_MS=180;
const TROLL_DEATH_FADE_MS=240;
const TROLL_COOLDOWN=1450;
const ROCK_SIZE=30;

function trollKey(action,direction,index){return `enemy2-${action}-${direction}-${String(index).padStart(3,'0')}`;}

export class GameSceneV08 extends GameSceneV07 {
  preload(){
    super.preload();
    for(const [action,meta] of Object.entries(ENEMY2_MANIFEST)){
      if(action==='rock'||typeof meta!=='object')continue;
      for(const direction of ['east','west']){
        const count=meta?.[direction]||0;
        for(let i=0;i<count;i++)this.load.image(trollKey(action,direction,i),`${ENEMY2_ROOT}/${action}/${direction}/frame_${String(i).padStart(3,'0')}.png?v=enemy2-2`);
      }
    }
    this.load.image('enemy2-rock',`${ENEMY2_ROOT}/${ENEMY2_MANIFEST.rock||'rock/rock.png'}?v=enemy2-2`);
  }

  create(){
    super.create();
    this.enemy2Projectiles=[];
    const troll=this.createEnemy2(1210,500);
    this.enemies.push(troll);
    this.roomEncounter.enemies.push(troll);
    this.physics.add.collider(troll.sprite,this.platforms);
    for(const gate of Object.values(this.roomGates||{}))this.physics.add.collider(troll.sprite,gate);
  }

  createEnemy2(x,y){
    const direction='west';
    const sprite=this.add.container(x,y);
    const shadow=this.add.ellipse(0,22,42,10,0x000000,.42);
    const art=this.add.image(0,TROLL_ART_Y,trollKey('patrol',direction,0)).setOrigin(.5,1).setScale(TROLL_SCALE).setDepth(2);
    sprite.add([shadow,art]); sprite.art=art; sprite.weapon={setAngle(){return this;}};
    this.physics.add.existing(sprite);
    sprite.body.setSize(24,40).setOffset(-12,-21).setCollideWorldBounds(true).setMaxVelocity(220,TUNING.maxFallSpeed);
    const tell=this.add.circle(x,y-10,28,0xe8b45a,.06).setStrokeStyle(2,0xffd27a,.75).setVisible(false).setDepth(45);
    const hpBarBg=this.add.rectangle(x,y-64,38,5,0x140a12,.8).setDepth(44);
    const hpBar=this.add.rectangle(x-18,y-64,36,3,0xe6b55f,1).setOrigin(0,.5).setDepth(45);
    return {id:`enemy2-${x}`,type:'enemy2',sprite,tell,hpBarBg,hpBar,hp:TROLL_HP,maxHp:TROLL_HP,alive:true,state:'dormant',stateEndsAt:0,nextAttackAt:0,facing:-1,animState:'patrol',animStartedAt:this.time.now,rockReleased:false,deathFadeStarted:false};
  }

  setTrollAnim(enemy,action,time,force=false){
    if(!ENEMY2_MANIFEST[action])action='patrol';
    if(!force&&enemy.animState===action)return;
    enemy.animState=action; enemy.animStartedAt=time;
  }

  trollAnimFps(action){
    if(action==='attack')return TROLL_ATTACK_FPS;
    if(action==='hit')return TROLL_HIT_FPS;
    if(action==='death')return TROLL_DEATH_FPS;
    return TROLL_WALK_FPS;
  }

  updateTrollArt(enemy,time){
    const action=enemy.animState||'patrol',direction=enemy.facing<0?'west':'east',meta=ENEMY2_MANIFEST[action];
    if(!meta)return;
    const count=meta[direction]||1,elapsed=Math.max(0,time-(enemy.animStartedAt||0)),fps=this.trollAnimFps(action);
    const looping=action==='patrol';
    const frame=looping?Math.floor(elapsed/1000*fps)%count:Math.min(count-1,Math.floor(elapsed/1000*fps));
    enemy.sprite.art.setTexture(trollKey(action,direction,frame)).setPosition(0,TROLL_ART_Y).setScale(TROLL_SCALE).setOrigin(.5,1)
      .setFlipX((direction==='west'&&!!meta.mirrorWest)||(direction==='east'&&!!meta.mirrorEast));
  }

  launchTrollRock(enemy){
    const rock=this.physics.add.image(enemy.sprite.x+enemy.facing*18,enemy.sprite.y-25,'enemy2-rock').setDepth(105).setDisplaySize(ROCK_SIZE,ROCK_SIZE);
    rock.body.setCircle(ROCK_SIZE*.36).setAllowGravity(true);
    const dx=this.player.x-rock.x,dy=(this.player.y-18)-rock.y,flight=Phaser.Math.Clamp(Math.abs(dx)/420,.58,.9),g=TUNING.gravityY;
    rock.setVelocity(Phaser.Math.Clamp(dx/flight,-450,450),(dy-.5*g*flight*flight)/flight);
    rock.setAngularVelocity(enemy.facing*520);
    const record={sprite:rock,alive:true}; this.enemy2Projectiles.push(record);
    const destroy=()=>{if(!record.alive)return;record.alive=false;rock.destroy();};
    this.physics.add.collider(rock,this.platforms,destroy);
    for(const gate of Object.values(this.roomGates||{}))this.physics.add.collider(rock,gate,destroy);
    this.physics.add.overlap(rock,this.player,()=>{if(!record.alive)return;this.damagePlayer(this.time.now,{sprite:rock});destroy();});
    this.time.delayedCall(2600,destroy);
  }

  updateEnemy2(enemy,time){
    if(enemy.state==='dead'){
      if(ENEMY2_MANIFEST.death)this.updateTrollArt(enemy,time);
      if(!enemy.deathFadeStarted&&time>=(enemy.deathEndsAt||0)){
        enemy.deathFadeStarted=true;
        this.tweens.add({targets:enemy.sprite,alpha:0,duration:TROLL_DEATH_FADE_MS,ease:'Quad.easeOut',onComplete:()=>enemy.sprite.setVisible(false)});
      }
      return;
    }
    if(!enemy.alive||this.dead)return;
    const body=enemy.sprite.body,dx=this.player.x-enemy.sprite.x,dist=Math.abs(dx);
    enemy.facing=dx<0?-1:1;
    enemy.tell.setPosition(enemy.sprite.x,enemy.sprite.y-10);
    enemy.hpBarBg.setPosition(enemy.sprite.x,enemy.sprite.y-64);
    enemy.hpBar.setPosition(enemy.sprite.x-18,enemy.sprite.y-64).setSize(36*(enemy.hp/enemy.maxHp),3);

    if(this.roomEncounter?.state==='inactive'){
      body.setVelocityX(0);enemy.state='dormant';this.setTrollAnim(enemy,'patrol',time);this.updateTrollArt(enemy,time);return;
    }
    if(enemy.state==='stagger'){
      body.velocity.x*=.78;
      if(ENEMY2_MANIFEST.hit)this.setTrollAnim(enemy,'hit',enemy.animStartedAt);
      else this.setTrollAnim(enemy,'patrol',time);
      if(time>=enemy.stateEndsAt){enemy.state='ranged';enemy.nextAttackAt=time+450;this.setTrollAnim(enemy,'patrol',time,true);}
      this.updateTrollArt(enemy,time);return;
    }
    if(enemy.state==='attack'){
      body.setVelocityX(0);this.setTrollAnim(enemy,'attack',enemy.animStartedAt);
      const count=ENEMY2_MANIFEST.attack?.[enemy.facing<0?'west':'east']||9;
      const duration=count/TROLL_ATTACK_FPS*1000;
      if(!enemy.rockReleased&&time-enemy.animStartedAt>=duration*.55){enemy.rockReleased=true;this.launchTrollRock(enemy);}
      if(time-enemy.animStartedAt>=duration){enemy.state='ranged';enemy.nextAttackAt=time+TROLL_COOLDOWN;this.setTrollAnim(enemy,'patrol',time,true);}
      this.updateTrollArt(enemy,time);return;
    }

    enemy.state='ranged';
    if(dist<TROLL_MIN_RANGE){body.setVelocityX(-enemy.facing*TROLL_SPEED);this.setTrollAnim(enemy,'patrol',time);}
    else if(dist>TROLL_PREFERRED_RANGE&&dist<TROLL_MAX_RANGE){body.setVelocityX(enemy.facing*TROLL_SPEED);this.setTrollAnim(enemy,'patrol',time);}
    else {body.setVelocityX(0);this.setTrollAnim(enemy,'patrol',time);}

    if(dist<=TROLL_MAX_RANGE&&dist>=165&&time>=enemy.nextAttackAt){enemy.state='attack';enemy.animStartedAt=time;enemy.rockReleased=false;body.setVelocityX(0);this.setTrollAnim(enemy,'attack',time,true);}
    this.updateTrollArt(enemy,time);
  }

  updateEnemy(enemy,time,index){
    if(enemy?.type==='enemy2'){this.updateEnemy2(enemy,time);return;}
    super.updateEnemy(enemy,time,index);
  }

  damageEnemy(enemy,step){
    if(enemy?.type!=='enemy2'){super.damageEnemy(enemy,step);return;}
    if(!enemy.alive)return;
    enemy.hp=Math.max(0,enemy.hp-1);
    const now=this.time.now;
    enemy.state='stagger';enemy.tell.setVisible(false);
    const direction=enemy.facing<0?'west':'east';
    const hitFrames=ENEMY2_MANIFEST.hit?.[direction]||0;
    const hitDuration=hitFrames?Math.ceil((hitFrames-1)/TROLL_HIT_FPS*1000)+90:150+step*45;
    enemy.stateEndsAt=now+hitDuration;
    if(hitFrames)this.setTrollAnim(enemy,'hit',now,true);
    enemy.sprite.body.setVelocity(this.facing*TUNING.attackKnockback[step]*.72,step===2?-105:-48);
    this.spawnImpactBurst(enemy.sprite.x,enemy.sprite.y-10,step);this.spawnCombatShockwave(enemy.sprite.x-this.facing*6,enemy.sprite.y-20,step);
    this.cameras.main.shake(step===2?90:45,step===2?.006:.003);this.applyHitStop(TUNING.hitStopMs[step]);
    if(enemy.hp<=0)this.killEnemy(enemy);this.updateHud();
  }

  killEnemy(enemy){
    if(enemy?.type!=='enemy2'){super.killEnemy(enemy);return;}
    if(!enemy.alive)return;
    const now=this.time.now;
    enemy.alive=false;enemy.state='dead';enemy.tell.setVisible(false);enemy.hpBar.setVisible(false);enemy.hpBarBg.setVisible(false);
    this.tweens.killTweensOf(enemy.sprite);
    enemy.sprite.setAlpha(1).setVisible(true);
    enemy.sprite.body.setVelocity(0,0);enemy.sprite.body.enable=false;
    const direction=enemy.facing<0?'west':'east';
    const deathFrames=ENEMY2_MANIFEST.death?.[direction]||0;
    if(deathFrames){
      this.setTrollAnim(enemy,'death',now,true);
      enemy.deathEndsAt=now+Math.ceil((deathFrames-1)/TROLL_DEATH_FPS*1000)+TROLL_DEATH_HOLD_MS;
      enemy.deathFadeStarted=false;
    }else{
      enemy.deathEndsAt=now+360;
      enemy.deathFadeStarted=true;
      this.tweens.add({targets:enemy.sprite,alpha:0,duration:340,ease:'Quad.easeOut',onComplete:()=>enemy.sprite.setVisible(false)});
    }
    this.updateHud();
  }

  update(time,delta){
    super.update(time,delta);
    this.enemy2Projectiles=this.enemy2Projectiles?.filter(p=>p.alive)||[];
    if(this.debug?.text)this.debug.setText(this.debug.text.replace('DARKBOUND v0.10.0 ENCOUNTER ROOM','DARKBOUND v0.11.1 ENEMY 2 HIT DEATH').replace('DARKBOUND v0.11.0 ENEMY 2 TROLL','DARKBOUND v0.11.1 ENEMY 2 HIT DEATH'));
  }
}
