import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const FALLBACK_ASSET_ROOT = './assets/v05/production58';
const PIXELLAB_ROOT = './assets/v05/pixellab_protagonist';
const ART_SCALE = 0.38;
const PIXELLAB_SCALE = 1.0;
const PIXELLAB_ART_Y = 72;
const ATTACK_LUNGE = [90,115,145];
const ATTACK_RECOIL = [28,36,48];
const VFX_GREEN = 0x65ff72;
const VFX_GREEN_HOT = 0xb8ff9a;

const LOOP_FPS = Object.freeze({idle:8,run:14});
const ONESHOT_FPS = Object.freeze({jump:12,fall:12,light_attack:18,heavy_attack:16,dash:18,hit:16,death:10});

const FALLBACK_SEQUENCES = Object.freeze({
  idle:{folder:'idle',frames:6},run:{folder:'run',frames:6},jump:{folder:'jump',frames:4},
  attack:{folder:'attack',frames:8},roll:{folder:'dodge',frames:8},hit:{folder:'hurt',frames:7},death:{folder:'death',frames:8}
});

function fallbackKey(name,index){
  return `fallback-${name}-${String(index+1).padStart(2,'0')}`;
}

function pxKey(action,direction,index){
  return `px-${action}-${direction}-${String(index).padStart(3,'0')}`;
}

export class GameSceneV05 extends GameScene {
  preload(){
    for(const [name,sequence] of Object.entries(FALLBACK_SEQUENCES)){
      for(let i=0;i<sequence.frames;i++){
        const file=`${sequence.folder}_${String(i+1).padStart(2,'0')}.png`;
        this.load.image(fallbackKey(name,i),`${FALLBACK_ASSET_ROOT}/${sequence.folder}/${file}?v=approved-r2`);
      }
    }

    for(const [action,directions] of Object.entries(PIXELLAB_MANIFEST)){
      for(const direction of ['east','west']){
        const count=directions[direction]||0;
        for(let i=0;i<count;i++){
          const file=`frame_${String(i).padStart(3,'0')}.png`;
          this.load.image(pxKey(action,direction,i),`${PIXELLAB_ROOT}/${action}/${direction}/${file}?v=pixellab-protagonist-2`);
        }
      }
    }
  }

  create(){
    super.create();
    this.hitAnimStartsAt=-Infinity;
    this.hitAnimEndsAt=-Infinity;
    this.deathAnimStartsAt=-Infinity;
    this.pixelState='idle';
    this.pixelStateStartedAt=this.time.now;
    this.pixelDirection='east';
    this.currentPixelKey='';
    this.attackFlash.setAlpha(0);
    this.attackArc.setVisible(false);
    this.player.art.setVisible(false);
    this.pixelArt=this.add.image(this.player.x,this.player.y+PIXELLAB_ART_Y,pxKey('idle','east',0))
      .setOrigin(.5,1)
      .setScale(PIXELLAB_SCALE)
      .setDepth(100);

    this.fxWasGrounded=!!this.player?.body?.blocked?.down;
    this.nextDashTrailAt=0;
  }

  createPlayer(x,y){
    const p=this.add.container(x,y);
    const shadow=this.add.ellipse(0,25,48,11,0x000000,.44);
    const aura=this.add.ellipse(0,4,42,74,0x69ff52,.018).setStrokeStyle(1,0x76ff42,.07);
    const art=this.add.image(0,27,fallbackKey('idle',0)).setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);
    const weaponProxy=this.add.rectangle(16,0,54,8,0xffffff,0).setOrigin(.08,.5);
    p.add([shadow,aura,art,weaponProxy]);
    p.art=art;
    p.aura=aura;
    p.weapon=weaponProxy;
    p.cape={setScale(){return this;}};
    this.physics.add.existing(p);
    p.body.setSize(28,54).setOffset(-14,-30).setCollideWorldBounds(true).setMaxVelocity(TUNING.rollSpeed,TUNING.maxFallSpeed);
    return p;
  }

  setPixelState(name,time,force=false){
    if(!PIXELLAB_MANIFEST[name])return;
    if(!force && this.pixelState===name)return;
    this.pixelState=name;
    this.pixelStateStartedAt=time;
    this.currentPixelKey='';
  }

  resolvePixelState(time){
    const body=this.player?.body;
    if(!body)return 'idle';
    if(this.dead)return 'death';
    if(time<this.hitAnimEndsAt)return 'hit';
    if(this.state==='rolling')return 'dash';
    if(this.state?.startsWith('attack-'))return this.comboStep===2?'heavy_attack':'light_attack';
    if(!body.blocked.down)return body.velocity.y<0?'jump':'fall';
    if(this.state==='running')return 'run';
    return 'idle';
  }

  frameForState(action,direction,time){
    const count=PIXELLAB_MANIFEST[action]?.[direction]||1;
    const elapsed=Math.max(0,time-this.pixelStateStartedAt);
    if(LOOP_FPS[action])return Math.floor(elapsed/1000*LOOP_FPS[action])%count;
    const fps=ONESHOT_FPS[action]||12;
    return Math.min(count-1,Math.floor(elapsed/1000*fps));
  }

  updatePixelArt(time){
    if(!this.pixelArt)return;
    const action=this.resolvePixelState(time);
    this.setPixelState(action,time);
    const direction=this.facing<0?'west':'east';
    if(direction!==this.pixelDirection){
      this.pixelDirection=direction;
      this.currentPixelKey='';
    }
    const frame=this.frameForState(action,direction,time);
    const key=pxKey(action,direction,frame);
    if(key!==this.currentPixelKey){
      this.pixelArt.setTexture(key);
      this.currentPixelKey=key;
    }
    this.pixelArt.setPosition(this.player.x,this.player.y+PIXELLAB_ART_Y).setOrigin(.5,1).setScale(PIXELLAB_SCALE).setVisible(true);
    this.player.art.setVisible(false);
  }

  spawnGreenBurst(x,y,count=7,spreadX=42,spreadY=28,life=190){
    for(let i=0;i<count;i++){
      const size=Phaser.Math.Between(2,4);
      const p=this.add.circle(x,y,size,i%3===0?VFX_GREEN_HOT:VFX_GREEN,.8)
        .setDepth(110)
        .setBlendMode(Phaser.BlendModes.ADD);
      const dx=Phaser.Math.Between(-spreadX,spreadX);
      const dy=Phaser.Math.Between(-spreadY,Math.max(4,Math.floor(spreadY*.35)));
      this.tweens.add({
        targets:p,
        x:x+dx,
        y:y+dy,
        scale:0.15,
        alpha:0,
        duration:Phaser.Math.Between(Math.max(90,life-50),life+60),
        ease:'Quad.easeOut',
        onComplete:()=>p.destroy()
      });
    }
  }

  spawnSwordFlare(step=0){
    const x=this.player.x+this.facing*(step===2?44:34);
    const y=this.player.y+PIXELLAB_ART_Y-46;
    const length=step===2?92:62;
    const flare=this.add.rectangle(x,y,length,step===2?7:4,VFX_GREEN_HOT,step===2?.78:.58)
      .setOrigin(this.facing>0?0:.99,.5)
      .setAngle(this.facing>0?-24:24)
      .setDepth(109)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets:flare,
      scaleX:1.25,
      scaleY:.25,
      alpha:0,
      duration:step===2?180:120,
      ease:'Quad.easeOut',
      onComplete:()=>flare.destroy()
    });
    this.spawnGreenBurst(x+this.facing*(step===2?48:30),y,step===2?10:5,step===2?40:26,22,step===2?230:150);
  }

  spawnDashTrail(){
    const x=this.player.x-this.facing*20;
    const y=this.player.y+PIXELLAB_ART_Y-34;
    const streak=this.add.rectangle(x,y,Phaser.Math.Between(26,44),Phaser.Math.Between(2,4),VFX_GREEN,.28)
      .setOrigin(this.facing>0?1:0,.5)
      .setDepth(90)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets:streak,
      x:x-this.facing*Phaser.Math.Between(18,36),
      scaleX:1.4,
      alpha:0,
      duration:115,
      ease:'Quad.easeOut',
      onComplete:()=>streak.destroy()
    });
  }

  spawnLandingBurst(){
    const x=this.player.x;
    const y=this.player.y+28;
    for(const dir of [-1,1]){
      const streak=this.add.rectangle(x,y,22,2,VFX_GREEN,.42)
        .setOrigin(dir<0?1:0,.5)
        .setDepth(95)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:streak,
        x:x+dir*32,
        scaleX:1.35,
        alpha:0,
        duration:150,
        ease:'Quad.easeOut',
        onComplete:()=>streak.destroy()
      });
    }
    this.spawnGreenBurst(x,y-2,5,28,12,150);
  }

  startAttack(time,step=null){
    super.startAttack(time,step);
    const body=this.player?.body;
    if(body?.blocked?.down)body.velocity.x+=this.facing*(ATTACK_LUNGE[this.comboStep]||ATTACK_LUNGE[0]);
    this.setPixelState(this.comboStep===2?'heavy_attack':'light_attack',time,true);
    this.spawnSwordFlare(this.comboStep);
  }

  damageEnemy(enemy,step){
    if(!enemy?.alive)return;
    const hpBefore=enemy.hp;
    super.damageEnemy(enemy,step);
    if(enemy.hp>=hpBefore)return;
    const body=this.player?.body;
    if(body)body.velocity.x-=this.facing*(ATTACK_RECOIL[step]||ATTACK_RECOIL[0]);
    this.spawnImpactBurst(enemy.sprite.x,enemy.sprite.y-8,step);
  }

  spawnImpactBurst(x,y,step){
    const radius=step===2?26:(step===1?21:17);
    const ring=this.add.circle(x,y,5,0xffffff,0)
      .setStrokeStyle(step===2?4:3,VFX_GREEN_HOT,.9)
      .setDepth(112)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:ring,scale:radius/5,alpha:0,duration:step===2?170:125,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});
    this.spawnGreenBurst(x,y,step===2?12:7,step===2?48:34,step===2?36:25,step===2?250:180);
  }

  startRoll(time,b){
    this.lastRollAt=time;
    this.rollEndsAt=time+TUNING.rollDurationMs;
    this.state='rolling';
    b.setVelocityX(this.facing*TUNING.rollSpeed);
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(1);
    this.setPixelState('dash',time,true);
    this.spawnGreenBurst(this.player.x,this.player.y+18,5,24,14,140);
    this.nextDashTrailAt=time;
  }

  damagePlayer(time,enemy){
    const hpBefore=this.playerHp;
    super.damagePlayer(time,enemy);
    if(this.playerHp<hpBefore){
      this.tweens.killTweensOf(this.player);
      this.player.setAlpha(1);
      if(!this.dead){
        this.hitAnimStartsAt=time;
        this.hitAnimEndsAt=time+420;
        this.setPixelState('hit',time,true);
      }
    }
  }

  killPlayer(){
    this.deathAnimStartsAt=this.time.now;
    super.killPlayer();
    this.setPixelState('death',this.time.now,true);
  }

  drawAttackArc(){
    this.attackArc.clear();
    this.attackArc.setVisible(false);
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.player)return;
    this.updatePixelArt(time);
    const body=this.player.body;
    const grounded=!!body?.blocked?.down;

    if(this.state==='rolling' && time>=this.nextDashTrailAt){
      this.spawnDashTrail();
      this.nextDashTrailAt=time+42;
    }

    if(grounded && !this.fxWasGrounded && Math.abs(body?.velocity?.y||0)<40){
      this.spawnLandingBurst();
    }
    this.fxWasGrounded=grounded;

    this.player.aura.setAlpha(.018+Math.min(.035,Math.abs(body?.velocity?.x||0)/9000));
    if(this.debug?.text){
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.7.4 GREEN VFX'));
    }
  }
}