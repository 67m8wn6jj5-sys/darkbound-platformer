import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';

const ASSET_ROOT = './assets/v05/production58';
const ART_SCALE = 0.38;
const BREATH_PERIOD_MS = 3200;
const BREATH_Y_PX = 0.8;
const BREATH_SCALE_Y = 0.006;
const ATTACK_LUNGE = [90,115,145];
const ATTACK_RECOIL = [28,36,48];
const PIXELLAB_RUN_EAST = './Running_v3_full_sprinting_east.gif?v=pixellab-run-test-2';
const PIXELLAB_RUN_WEST = './Running_v3_full_sprinting_west.gif?v=pixellab-run-test-2';
const PIXELLAB_RUN_WIDTH_PX = 192;
const PIXELLAB_RUN_ANCHOR_Y = 27;
const PIXELLAB_RUN_VISUAL_OFFSET_Y = 28;

const SEQUENCES = Object.freeze({
  idle:{folder:'idle',frames:6,frameRate:2},run:{folder:'run',frames:6,frameRate:14},jump:{folder:'jump',frames:4,frameRate:10},
  attack1:{folder:'attack',frames:8,frameRate:30},attack2:{folder:'attack',frames:8,frameRate:28},attack3:{folder:'attack',frames:8,frameRate:24},
  roll:{folder:'dodge',frames:8,frameRate:20},hit:{folder:'hurt',frames:7,frameRate:20},death:{folder:'death',frames:8,frameRate:8}
});

function textureKey(name,index){return `approved-r2-${name}-${String(index+1).padStart(2,'0')}`;}

export class GameSceneV05 extends GameScene {
  preload(){
    for(const [name,sequence] of Object.entries(SEQUENCES)){
      for(let i=0;i<sequence.frames;i++){
        const file=`${sequence.folder}_${String(i+1).padStart(2,'0')}.png`;
        this.load.image(textureKey(name,i),`${ASSET_ROOT}/${sequence.folder}/${file}?v=approved-r2`);
      }
    }
  }

  create(){
    super.create();
    this.hitAnimStartsAt=-Infinity;this.hitAnimEndsAt=-Infinity;this.deathAnimStartsAt=-Infinity;
    this.wasGrounded=true;this.landingAnimEndsAt=0;this.currentProtagonistKey='';
    this.attackFlash.setAlpha(0);this.attackArc.setVisible(false);this.setProtagonistFrame('idle',0);
    this.createPixelLabRunTest();
  }

  createPixelLabRunTest(){
    const makeRunElement=(src)=>{
      const wrapper=document.createElement('div');
      wrapper.style.width=`${PIXELLAB_RUN_WIDTH_PX}px`;
      wrapper.style.height=`${PIXELLAB_RUN_WIDTH_PX}px`;
      wrapper.style.overflow='visible';
      wrapper.style.pointerEvents='none';
      wrapper.style.position='relative';
      const img=document.createElement('img');
      img.src=src;img.alt='';img.draggable=false;
      img.style.width='100%';img.style.height='auto';img.style.display='block';
      img.style.position='absolute';img.style.left='0';img.style.bottom=`-${PIXELLAB_RUN_VISUAL_OFFSET_Y}px`;
      img.style.imageRendering='pixelated';img.style.pointerEvents='none';img.style.userSelect='none';img.style.webkitUserDrag='none';
      wrapper.appendChild(img);
      return this.add.dom(this.player.x,this.player.y+PIXELLAB_RUN_ANCHOR_Y,wrapper)
        .setOrigin(.5,1).setDepth(100).setVisible(false);
    };
    this.pixelLabRunEast=makeRunElement(PIXELLAB_RUN_EAST);
    this.pixelLabRunWest=makeRunElement(PIXELLAB_RUN_WEST);
  }

  updatePixelLabRun(activeName){
    const running=activeName==='run'&&!this.dead;
    const x=this.player.x,y=this.player.y+PIXELLAB_RUN_ANCHOR_Y;
    this.pixelLabRunEast?.setPosition(x,y).setVisible(running&&this.facing>0);
    this.pixelLabRunWest?.setPosition(x,y).setVisible(running&&this.facing<0);
    this.player.art.setVisible(!running);
  }

  setProtagonistFrame(name,frameNumber){
    const art=this.player?.art,sequence=SEQUENCES[name];if(!art||!sequence)return;
    const frame=Math.max(0,Math.min(sequence.frames-1,Math.floor(frameNumber))),key=textureKey(name,frame);
    if(key===this.currentProtagonistKey)return;art.setTexture(key);art.setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);this.currentProtagonistKey=key;
  }
  loopFrame(name,time){const s=SEQUENCES[name];return Math.floor((time/1000)*s.frameRate)%s.frames;}
  progressFrame(name,progress){const s=SEQUENCES[name],clamped=Math.max(0,Math.min(.999,progress));return Math.min(s.frames-1,Math.floor(clamped*s.frames));}

  createPlayer(x,y){
    const p=this.add.container(x,y);const shadow=this.add.ellipse(0,25,48,11,0x000000,.44);const aura=this.add.ellipse(0,4,42,74,0x69ff52,.018).setStrokeStyle(1,0x76ff42,.07);
    const art=this.add.image(0,27,textureKey('idle',0)).setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);const weaponProxy=this.add.rectangle(16,0,54,8,0xffffff,0).setOrigin(.08,.5);
    p.add([shadow,aura,art,weaponProxy]);p.art=art;p.aura=aura;p.weapon=weaponProxy;p.cape={setScale(){return this;}};this.physics.add.existing(p);
    p.body.setSize(28,54).setOffset(-14,-30).setCollideWorldBounds(true).setMaxVelocity(TUNING.rollSpeed,TUNING.maxFallSpeed);return p;
  }

  startAttack(time,step=null){super.startAttack(time,step);const body=this.player?.body;if(body?.blocked?.down)body.velocity.x+=this.facing*(ATTACK_LUNGE[this.comboStep]||ATTACK_LUNGE[0]);}
  damageEnemy(enemy,step){
    if(!enemy?.alive)return;const hpBefore=enemy.hp;super.damageEnemy(enemy,step);if(enemy.hp>=hpBefore)return;
    const body=this.player?.body;if(body)body.velocity.x-=this.facing*(ATTACK_RECOIL[step]||ATTACK_RECOIL[0]);
    this.tweens.killTweensOf(enemy.sprite);const kickAngle=this.facing*(step===2?10:(step===1?7:5));
    this.tweens.add({targets:enemy.sprite,angle:kickAngle,scaleY:step===2?.82:.9,duration:45,yoyo:true,ease:'Quad.easeOut',onComplete:()=>{if(enemy.alive){enemy.sprite.setAngle(0);enemy.sprite.scaleY=1;}}});
    this.spawnImpactBurst(enemy.sprite.x,enemy.sprite.y-8,step);
  }
  spawnImpactBurst(x,y,step){
    const radius=step===2?24:(step===1?19:15),color=step===2?0xffe7a8:0xf4fbff;const ring=this.add.circle(x,y,5,0xffffff,0).setStrokeStyle(step===2?4:3,color,.95).setDepth(75);
    this.tweens.add({targets:ring,scale:radius/5,alpha:0,duration:step===2?155:120,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});
    const slash=this.add.rectangle(x+this.facing*4,y,step===2?34:24,3,color,.9).setDepth(76).setAngle(step===1?22:-18*this.facing);
    this.tweens.add({targets:slash,scaleX:1.45,alpha:0,duration:100+step*20,ease:'Quad.easeOut',onComplete:()=>slash.destroy()});
  }
  startRoll(time,b){this.lastRollAt=time;this.rollEndsAt=time+TUNING.rollDurationMs;this.state='rolling';b.setVelocityX(this.facing*TUNING.rollSpeed);this.tweens.killTweensOf(this.player);this.player.setAlpha(1);}
  damagePlayer(time,enemy){const hpBefore=this.playerHp;super.damagePlayer(time,enemy);if(this.playerHp<hpBefore){this.tweens.killTweensOf(this.player);this.player.setAlpha(1);if(!this.dead){this.hitAnimStartsAt=time;this.hitAnimEndsAt=time+300;}}}
  killPlayer(){this.deathAnimStartsAt=this.time.now;super.killPlayer();}
  drawAttackArc(){this.attackArc.clear();this.attackArc.setVisible(false);}

  updateProtagonistFrame(time){
    const body=this.player?.body;if(!body)return'idle';const grounded=!!body.blocked.down;let name='idle',frame=0;
    if(this.dead){name='death';const elapsed=Math.max(0,time-this.deathAnimStartsAt),duration=((SEQUENCES.death.frames-1)/SEQUENCES.death.frameRate)*1000;frame=this.progressFrame(name,Math.min(1,elapsed/Math.max(1,duration)));}
    else if(time<this.hitAnimEndsAt){name='hit';frame=this.progressFrame(name,(time-this.hitAnimStartsAt)/300);}
    else if(this.state==='rolling'){name='roll';const startedAt=this.rollEndsAt-TUNING.rollDurationMs;frame=this.progressFrame(name,(time-startedAt)/TUNING.rollDurationMs);}
    else if(this.state?.startsWith('attack-')){name=['attack1','attack2','attack3'][this.comboStep]||'attack1';const duration=TUNING.attackDurationsMs[this.comboStep]||TUNING.attackDurationsMs[0];frame=this.progressFrame(name,(time-this.attackStartsAt)/duration);}
    else if(!grounded){name='jump';frame=body.velocity.y<-260?0:(body.velocity.y<80?1:(body.velocity.y<420?2:3));}
    else if(!this.wasGrounded){name='jump';this.landingAnimEndsAt=time+95;frame=3;}
    else if(time<this.landingAnimEndsAt){name='jump';frame=3;}
    else if(this.state==='running'){name='run';frame=this.loopFrame(name,time);}
    else{name='idle';frame=this.loopFrame(name,time);}
    this.setProtagonistFrame(name,frame);this.wasGrounded=grounded;return name;
  }

  update(time,delta){
    super.update(time,delta);if(!this.player?.art)return;const body=this.player.body,activeName=this.updateProtagonistFrame(time);this.updatePixelLabRun(activeName);
    if(activeName==='idle'&&!this.dead){const phase=(time%BREATH_PERIOD_MS)/BREATH_PERIOD_MS*Math.PI*2,breath=(1-Math.cos(phase))*.5;this.player.art.setPosition(0,27-BREATH_Y_PX*breath).setOrigin(.5,1).setScale(ART_SCALE,ART_SCALE*(1+BREATH_SCALE_Y*breath)).setAlpha(1);}
    else if(activeName!=='run')this.player.art.setPosition(0,27).setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);
    this.player.aura.setAlpha(.015+Math.min(.025,Math.abs(body?.velocity?.x||0)/10000));
    if(this.debug?.text)this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.6.3 PIXELLAB RUN ALIGN FIX'));
  }
}
