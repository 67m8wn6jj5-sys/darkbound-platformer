import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';

const FRAME_SIZE = 128;
const FRAMES_PER_ROW = 8;

const SEQUENCES = Object.freeze({
  idle:    { row:0, frames:7, frameRate:6 },
  run:     { row:1, frames:7, frameRate:14 },
  jump:    { row:2, frames:6, frameRate:10 },
  attack1: { row:3, frames:7, frameRate:36 },
  attack2: { row:4, frames:7, frameRate:33 },
  attack3: { row:5, frames:8, frameRate:29 },
  roll:    { row:6, frames:8, frameRate:21 },
  hit:     { row:7, frames:8, frameRate:30 },
  death:   { row:8, frames:8, frameRate:12 }
});

export class GameSceneV05 extends GameScene {
  preload(){
    // Load as a normal image. Safari/WebGL was unreliable when the indexed PNG
    // was handed directly to Phaser's spritesheet/animation pipeline.
    this.load.image('v05-protagonist-source','./assets/v05/protagonist-atlas.png?v=052');
  }

  create(){
    this.prepareProtagonistRuntimeTexture();
    super.create();

    this.hitAnimStartsAt=-Infinity;
    this.hitAnimEndsAt=-Infinity;
    this.deathAnimStartsAt=-Infinity;
    this.wasGrounded=true;
    this.landingAnimEndsAt=0;
    this.attackFlash.setAlpha(.08);
    this.setProtagonistFrame(0);
  }

  prepareProtagonistRuntimeTexture(){
    this.protagonistSource=this.textures.get('v05-protagonist-source').getSourceImage();
    const existing=this.textures.get('v05-protagonist-frame');
    if(existing?.key && existing.key!=='__MISSING')this.textures.remove('v05-protagonist-frame');

    this.protagonistCanvas=this.textures.createCanvas('v05-protagonist-frame',FRAME_SIZE,FRAME_SIZE);
    this.protagonistContext=this.protagonistCanvas.getContext();
    this.currentProtagonistFrame=-1;
    this.setProtagonistFrame(0);
  }

  setProtagonistFrame(frameNumber){
    if(!this.protagonistCanvas || !this.protagonistSource)return;
    const maxFrame=(9*FRAMES_PER_ROW)-1;
    const frame=Math.max(0,Math.min(maxFrame,Math.floor(frameNumber)));
    if(frame===this.currentProtagonistFrame)return;

    const sx=(frame%FRAMES_PER_ROW)*FRAME_SIZE;
    const sy=Math.floor(frame/FRAMES_PER_ROW)*FRAME_SIZE;
    const ctx=this.protagonistContext;
    ctx.clearRect(0,0,FRAME_SIZE,FRAME_SIZE);
    ctx.drawImage(
      this.protagonistSource,
      sx,sy,FRAME_SIZE,FRAME_SIZE,
      0,0,FRAME_SIZE,FRAME_SIZE
    );
    this.protagonistCanvas.refresh();
    this.currentProtagonistFrame=frame;
  }

  frameFromLoop(name,time){
    const s=SEQUENCES[name];
    const local=Math.floor((time/1000)*s.frameRate)%s.frames;
    return s.row*FRAMES_PER_ROW+local;
  }

  frameFromProgress(name,progress){
    const s=SEQUENCES[name];
    const clamped=Math.max(0,Math.min(.999,progress));
    const local=Math.min(s.frames-1,Math.floor(clamped*s.frames));
    return s.row*FRAMES_PER_ROW+local;
  }

  createPlayer(x,y){
    const p=this.add.container(x,y);
    const shadow=this.add.ellipse(0,25,48,11,0x000000,.44);
    const aura=this.add.ellipse(0,4,42,74,0x69ff52,.025)
      .setStrokeStyle(1,0x76ff42,.10);
    const art=this.add.image(0,-27,'v05-protagonist-frame')
      .setOrigin(.5,.5)
      .setDisplaySize(96,96);
    const weaponProxy=this.add.rectangle(16,0,54,8,0xffffff,0).setOrigin(.08,.5);

    p.add([shadow,aura,art,weaponProxy]);
    p.art=art;
    p.aura=aura;
    p.weapon=weaponProxy;
    p.cape={setScale(){return this;}};

    this.physics.add.existing(p);
    p.body
      .setSize(28,54)
      .setOffset(-14,-30)
      .setCollideWorldBounds(true)
      .setMaxVelocity(TUNING.rollSpeed,TUNING.maxFallSpeed);
    return p;
  }

  damagePlayer(time,enemy){
    const hpBefore=this.playerHp;
    super.damagePlayer(time,enemy);
    if(this.playerHp<hpBefore && !this.dead){
      this.hitAnimStartsAt=time;
      this.hitAnimEndsAt=time+250;
    }
  }

  killPlayer(){
    this.deathAnimStartsAt=this.time.now;
    super.killPlayer();
  }

  drawAttackArc(active,step){
    this.attackArc.clear();
    this.attackArc.setVisible(active);
    if(!active)return;
    const radius=[43,51,63][step];
    const start=this.facing>0?-0.72:Math.PI+0.72;
    const end=this.facing>0?0.68:Math.PI-0.68;
    this.attackArc.lineStyle(step===2?4:3,step===2?0xb7ff30:0x72ff24,step===2?.95:.90);
    this.attackArc.beginPath();
    this.attackArc.arc(this.player.x,this.player.y-3,radius,start,end,this.facing<0);
    this.attackArc.strokePath();
  }

  updateProtagonistFrame(time){
    const body=this.player?.body;
    if(!body)return;
    const grounded=!!body.blocked.down;
    let frame=0;

    if(this.dead){
      const elapsed=Math.max(0,time-this.deathAnimStartsAt);
      const duration=((SEQUENCES.death.frames-1)/SEQUENCES.death.frameRate)*1000;
      frame=this.frameFromProgress('death',Math.min(1,elapsed/Math.max(1,duration)));
    } else if(time<this.hitAnimEndsAt){
      frame=this.frameFromProgress('hit',(time-this.hitAnimStartsAt)/250);
    } else if(this.state==='rolling'){
      const startedAt=this.rollEndsAt-TUNING.rollDurationMs;
      frame=this.frameFromProgress('roll',(time-startedAt)/TUNING.rollDurationMs);
    } else if(this.state?.startsWith('attack-')){
      const name=['attack1','attack2','attack3'][this.comboStep]||'attack1';
      const duration=TUNING.attackDurationsMs[this.comboStep]||TUNING.attackDurationsMs[0];
      frame=this.frameFromProgress(name,(time-this.attackStartsAt)/duration);
    } else if(!grounded){
      const local=body.velocity.y<-260?1:(body.velocity.y<80?2:(body.velocity.y<420?3:4));
      frame=SEQUENCES.jump.row*FRAMES_PER_ROW+local;
    } else if(!this.wasGrounded){
      this.landingAnimEndsAt=time+95;
      frame=SEQUENCES.jump.row*FRAMES_PER_ROW+5;
    } else if(time<this.landingAnimEndsAt){
      frame=SEQUENCES.jump.row*FRAMES_PER_ROW+5;
    } else if(this.state==='running'){
      frame=this.frameFromLoop('run',time);
    } else {
      frame=this.frameFromLoop('idle',time);
    }

    this.setProtagonistFrame(frame);
    this.wasGrounded=grounded;
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.player?.art)return;

    const body=this.player.body;
    this.player.art.setPosition(0,-27).setDisplaySize(96,96);
    this.player.aura.setAlpha(.02+Math.min(.04,Math.abs(body?.velocity?.x||0)/8000));
    this.updateProtagonistFrame(time);

    if(this.debug?.text){
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.5.2 PRODUCTION'));
    }
  }
}
