import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';

const FRAME_SIZE = 128;
const SEQUENCES = Object.freeze({
  idle:    { frames:7, frameRate:6 },
  run:     { frames:7, frameRate:14 },
  jump:    { frames:6, frameRate:10 },
  attack1: { frames:7, frameRate:36 },
  attack2: { frames:7, frameRate:33 },
  attack3: { frames:8, frameRate:29 },
  roll:    { frames:8, frameRate:21 },
  hit:     { frames:8, frameRate:30 },
  death:   { frames:8, frameRate:12 }
});

export class GameSceneV05 extends GameScene {
  preload(){
    // Each animation is its own independent PNG spritesheet. The old combined
    // protagonist atlas is never loaded by the game.
    for(const name of Object.keys(SEQUENCES)){
      this.load.spritesheet(
        `v05-${name}`,
        `./assets/v05/animations/${name}.png?v=056`,
        { frameWidth:FRAME_SIZE, frameHeight:FRAME_SIZE }
      );
    }
  }

  create(){
    super.create();
    this.hitAnimStartsAt=-Infinity;
    this.hitAnimEndsAt=-Infinity;
    this.deathAnimStartsAt=-Infinity;
    this.wasGrounded=true;
    this.landingAnimEndsAt=0;
    this.attackFlash.setAlpha(.08);
    this.currentProtagonistKey='';
    this.setProtagonistFrame('idle',0);
  }

  setProtagonistFrame(name,frameNumber){
    const art=this.player?.art;
    const sequence=SEQUENCES[name];
    if(!art || !sequence)return;
    const frame=Math.max(0,Math.min(sequence.frames-1,Math.floor(frameNumber)));
    const key=`${name}:${frame}`;
    if(key===this.currentProtagonistKey)return;
    art.setTexture(`v05-${name}`,frame);
    art.setAlpha(1).setDisplaySize(96,96);
    this.currentProtagonistKey=key;
  }

  loopFrame(name,time){
    const s=SEQUENCES[name];
    return Math.floor((time/1000)*s.frameRate)%s.frames;
  }

  progressFrame(name,progress){
    const s=SEQUENCES[name];
    const clamped=Math.max(0,Math.min(.999,progress));
    return Math.min(s.frames-1,Math.floor(clamped*s.frames));
  }

  createPlayer(x,y){
    const p=this.add.container(x,y);
    const shadow=this.add.ellipse(0,25,48,11,0x000000,.44);
    const aura=this.add.ellipse(0,4,42,74,0x69ff52,.025).setStrokeStyle(1,0x76ff42,.10);
    const art=this.add.sprite(0,-27,'v05-idle',0).setOrigin(.5,.5).setDisplaySize(96,96).setAlpha(1);
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
    let name='idle';
    let frame=0;

    if(this.dead){
      name='death';
      const elapsed=Math.max(0,time-this.deathAnimStartsAt);
      const duration=((SEQUENCES.death.frames-1)/SEQUENCES.death.frameRate)*1000;
      frame=this.progressFrame(name,Math.min(1,elapsed/Math.max(1,duration)));
    } else if(time<this.hitAnimEndsAt){
      name='hit';
      frame=this.progressFrame(name,(time-this.hitAnimStartsAt)/250);
    } else if(this.state==='rolling'){
      name='roll';
      const startedAt=this.rollEndsAt-TUNING.rollDurationMs;
      frame=this.progressFrame(name,(time-startedAt)/TUNING.rollDurationMs);
    } else if(this.state?.startsWith('attack-')){
      name=['attack1','attack2','attack3'][this.comboStep]||'attack1';
      const duration=TUNING.attackDurationsMs[this.comboStep]||TUNING.attackDurationsMs[0];
      frame=this.progressFrame(name,(time-this.attackStartsAt)/duration);
    } else if(!grounded){
      name='jump';
      frame=body.velocity.y<-260?1:(body.velocity.y<80?2:(body.velocity.y<420?3:4));
    } else if(!this.wasGrounded){
      name='jump';
      this.landingAnimEndsAt=time+95;
      frame=5;
    } else if(time<this.landingAnimEndsAt){
      name='jump';
      frame=5;
    } else if(this.state==='running'){
      name='run';
      frame=this.loopFrame(name,time);
    } else {
      frame=this.loopFrame(name,time);
    }

    this.setProtagonistFrame(name,frame);
    this.wasGrounded=grounded;
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.player?.art)return;
    const body=this.player.body;
    this.player.art.setPosition(0,-27).setDisplaySize(96,96).setAlpha(1);
    this.player.aura.setAlpha(.02+Math.min(.04,Math.abs(body?.velocity?.x||0)/8000));
    this.updateProtagonistFrame(time);
    if(this.debug?.text){
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.5.6 PRODUCTION'));
    }
  }
}
