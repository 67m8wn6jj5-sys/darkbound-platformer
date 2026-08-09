import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';

const FALLBACK_ASSET_ROOT = './assets/v05/production58';
const PIXELLAB_ROOT = './assets/v05/pixellab_protagonist';
const PIXELLAB_WIDTH_PX = 192;
const PIXELLAB_ANCHOR_Y = 27;
const ART_SCALE = 0.38;
const ATTACK_LUNGE = [90,115,145];
const ATTACK_RECOIL = [28,36,48];

const FALLBACK_SEQUENCES = Object.freeze({
  idle:{folder:'idle',frames:6}, run:{folder:'run',frames:6}, jump:{folder:'jump',frames:4},
  attack:{folder:'attack',frames:8}, roll:{folder:'dodge',frames:8}, hit:{folder:'hurt',frames:7}, death:{folder:'death',frames:8}
});

const PIXELLAB_GIFS = Object.freeze({
  idle:`${PIXELLAB_ROOT}/idle.gif?v=pixellab-protagonist-1`,
  run:`${PIXELLAB_ROOT}/run.gif?v=pixellab-protagonist-1`,
  jump:`${PIXELLAB_ROOT}/jump.gif?v=pixellab-protagonist-1`,
  fall:`${PIXELLAB_ROOT}/fall.gif?v=pixellab-protagonist-1`,
  light_attack:`${PIXELLAB_ROOT}/light_attack.gif?v=pixellab-protagonist-1`,
  heavy_attack:`${PIXELLAB_ROOT}/heavy_attack.gif?v=pixellab-protagonist-1`,
  dash:`${PIXELLAB_ROOT}/dash.gif?v=pixellab-protagonist-1`,
  hit:`${PIXELLAB_ROOT}/hit.gif?v=pixellab-protagonist-1`,
  death:`${PIXELLAB_ROOT}/death.gif?v=pixellab-protagonist-1`
});

function fallbackKey(name,index){
  return `fallback-${name}-${String(index+1).padStart(2,'0')}`;
}

export class GameSceneV05 extends GameScene {
  preload(){
    for(const [name,sequence] of Object.entries(FALLBACK_SEQUENCES)){
      for(let i=0;i<sequence.frames;i++){
        const file=`${sequence.folder}_${String(i+1).padStart(2,'0')}.png`;
        this.load.image(fallbackKey(name,i),`${FALLBACK_ASSET_ROOT}/${sequence.folder}/${file}?v=approved-r2`);
      }
    }
  }

  create(){
    super.create();
    this.hitAnimStartsAt=-Infinity;
    this.hitAnimEndsAt=-Infinity;
    this.deathAnimStartsAt=-Infinity;
    this.currentPixelLabState='';
    this.attackFlash.setAlpha(0);
    this.attackArc.setVisible(false);
    this.createPixelLabProtagonist();
    this.player.art.setVisible(false);
  }

  createPixelLabProtagonist(){
    const img=document.createElement('img');
    img.alt='';
    img.draggable=false;
    img.style.width=`${PIXELLAB_WIDTH_PX}px`;
    img.style.height='auto';
    img.style.display='block';
    img.style.imageRendering='pixelated';
    img.style.pointerEvents='none';
    img.style.userSelect='none';
    img.style.webkitUserDrag='none';
    img.style.transformOrigin='50% 100%';

    this.pixelLabImg=img;
    this.pixelLabDom=this.add.dom(this.player.x,this.player.y+PIXELLAB_ANCHOR_Y,img)
      .setOrigin(.5,1)
      .setDepth(100);
    this.setPixelLabState('idle',true);
  }

  setPixelLabState(name,force=false){
    if(!this.pixelLabImg || !PIXELLAB_GIFS[name])return;
    if(!force && this.currentPixelLabState===name)return;
    this.currentPixelLabState=name;
    this.pixelLabImg.src=PIXELLAB_GIFS[name];
  }

  resolvePixelLabState(time){
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

  updatePixelLabProtagonist(time){
    if(!this.pixelLabDom || !this.pixelLabImg)return;
    const state=this.resolvePixelLabState(time);
    this.setPixelLabState(state);
    this.pixelLabDom.setPosition(this.player.x,this.player.y+PIXELLAB_ANCHOR_Y).setVisible(true);
    this.pixelLabImg.style.transform=this.facing<0?'scaleX(-1)':'scaleX(1)';
    this.player.art.setVisible(false);
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

  startAttack(time,step=null){
    super.startAttack(time,step);
    const body=this.player?.body;
    if(body?.blocked?.down){
      body.velocity.x+=this.facing*(ATTACK_LUNGE[this.comboStep]||ATTACK_LUNGE[0]);
    }
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
    const radius=step===2?24:(step===1?19:15);
    const color=step===2?0xffe7a8:0xf4fbff;
    const ring=this.add.circle(x,y,5,0xffffff,0).setStrokeStyle(step===2?4:3,color,.95).setDepth(75);
    this.tweens.add({targets:ring,scale:radius/5,alpha:0,duration:step===2?155:120,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});
  }

  startRoll(time,b){
    this.lastRollAt=time;
    this.rollEndsAt=time+TUNING.rollDurationMs;
    this.state='rolling';
    b.setVelocityX(this.facing*TUNING.rollSpeed);
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(1);
  }

  damagePlayer(time,enemy){
    const hpBefore=this.playerHp;
    super.damagePlayer(time,enemy);
    if(this.playerHp<hpBefore){
      this.tweens.killTweensOf(this.player);
      this.player.setAlpha(1);
      if(!this.dead){
        this.hitAnimStartsAt=time;
        this.hitAnimEndsAt=time+360;
        this.setPixelLabState('hit',true);
      }
    }
  }

  killPlayer(){
    this.deathAnimStartsAt=this.time.now;
    super.killPlayer();
    this.setPixelLabState('death',true);
  }

  drawAttackArc(){
    this.attackArc.clear();
    this.attackArc.setVisible(false);
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.player)return;
    this.updatePixelLabProtagonist(time);
    const body=this.player.body;
    this.player.aura.setAlpha(.015+Math.min(.025,Math.abs(body?.velocity?.x||0)/10000));
    if(this.debug?.text){
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.7.0 PIXELLAB PROTAGONIST'));
    }
  }
}
