import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const FALLBACK_ASSET_ROOT = './assets/v05/production58';
const PIXELLAB_ROOT = './assets/v05/pixellab_protagonist';
const ART_SCALE = 0.38;
const PIXELLAB_SCALE = 1.0;
// PixelLab frames include transparent padding below the character. Keep the
// physics body on the real floor and lower only the rendered art so the
// visible boots meet the collision surface.
const PIXELLAB_ART_Y = 118;
const ATTACK_LUNGE = [90,115,145];
const ATTACK_RECOIL = [28,36,48];

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

  startAttack(time,step=null){
    super.startAttack(time,step);
    const body=this.player?.body;
    if(body?.blocked?.down)body.velocity.x+=this.facing*(ATTACK_LUNGE[this.comboStep]||ATTACK_LUNGE[0]);
    this.setPixelState(this.comboStep===2?'heavy_attack':'light_attack',time,true);
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
    this.setPixelState('dash',time,true);
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
    this.player.aura.setAlpha(.015+Math.min(.025,Math.abs(body?.velocity?.x||0)/10000));
    if(this.debug?.text){
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.7.1 PIXELLAB ALIGNMENT'));
    }
  }
}