import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';

const ASSET_ROOT = './assets/v05/production58';
const ART_SCALE = 0.38;

// v0.5.8 production art: every frame is an independent transparent PNG.
// No atlases, strips, frame cropping, or deploy-time sprite reconstruction.
const SEQUENCES = Object.freeze({
  idle:    { folder:'idle',            frames:5, frameRate:6  },
  run:     { folder:'run',             frames:7, frameRate:14 },
  jump:    { folder:'jump',            frames:4, frameRate:10 },
  attack1: { folder:'attack_combo',    frames:5, frameRate:30 },
  attack2: { folder:'attack_overhead', frames:6, frameRate:28 },
  attack3: { folder:'attack_heavy',    frames:5, frameRate:24 },
  roll:    { folder:'dodge_roll',      frames:7, frameRate:20 },
  hit:     { folder:'hurt',            frames:5, frameRate:20 },
  death:   { folder:'death',           frames:5, frameRate:8  }
});

function textureKey(name,index){
  return `v058-${name}-${String(index+1).padStart(2,'0')}`;
}

export class GameSceneV05 extends GameScene {
  preload(){
    for(const [name,sequence] of Object.entries(SEQUENCES)){
      for(let i=0;i<sequence.frames;i++){
        const file=`${sequence.folder}_${String(i+1).padStart(2,'0')}.png`;
        this.load.image(textureKey(name,i),`${ASSET_ROOT}/${sequence.folder}/${file}?v=058prod`);
      }
    }
  }

  create(){
    super.create();
    this.hitAnimStartsAt=-Infinity;
    this.hitAnimEndsAt=-Infinity;
    this.deathAnimStartsAt=-Infinity;
    this.wasGrounded=true;
    this.landingAnimEndsAt=0;
    this.currentProtagonistKey='';

    // The production attack frames already contain the approved sword effects.
    // Keep the gameplay hitbox objects, but do not draw duplicate placeholder VFX.
    this.attackFlash.setAlpha(0);
    this.attackArc.setVisible(false);
    this.setProtagonistFrame('idle',0);
  }

  setProtagonistFrame(name,frameNumber){
    const art=this.player?.art;
    const sequence=SEQUENCES[name];
    if(!art || !sequence)return;
    const frame=Math.max(0,Math.min(sequence.frames-1,Math.floor(frameNumber)));
    const key=textureKey(name,frame);
    if(key===this.currentProtagonistKey)return;
    art.setTexture(key);
    art.setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);
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
    const aura=this.add.ellipse(0,4,42,74,0x69ff52,.018).setStrokeStyle(1,0x76ff42,.07);
    const art=this.add.image(0,27,textureKey('idle',0)).setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);
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

  // Preserve dodge timing/velocity but remove the old intentional translucency.
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
      // Hit readability comes from the approved Hurt frames, sparks and shake;
      // do not fade the character itself.
      this.tweens.killTweensOf(this.player);
      this.player.setAlpha(1);
      if(!this.dead){
        this.hitAnimStartsAt=time;
        this.hitAnimEndsAt=time+250;
      }
    }
  }

  killPlayer(){
    this.deathAnimStartsAt=this.time.now;
    super.killPlayer();
  }

  drawAttackArc(){
    this.attackArc.clear();
    this.attackArc.setVisible(false);
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
      frame=body.velocity.y<-260?0:(body.velocity.y<80?1:(body.velocity.y<420?2:3));
    } else if(!this.wasGrounded){
      name='jump';
      this.landingAnimEndsAt=time+95;
      frame=3;
    } else if(time<this.landingAnimEndsAt){
      name='jump';
      frame=3;
    } else if(this.state==='running'){
      name='run';
      frame=this.loopFrame(name,time);
    } else {
      name='idle';
      frame=this.loopFrame(name,time);
    }

    this.setProtagonistFrame(name,frame);
    this.wasGrounded=grounded;
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.player?.art)return;

    const body=this.player.body;
    // All production frames are bottom-center registered. A constant scale keeps
    // the protagonist's body size consistent while allowing attack/jump canvases
    // to grow around the same gameplay anchor without clipping.
    this.player.art.setPosition(0,27).setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);
    this.player.aura.setAlpha(.015+Math.min(.025,Math.abs(body?.velocity?.x||0)/10000));
    this.updateProtagonistFrame(time);

    if(this.debug?.text){
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.5.8 PRODUCTION'));
    }
  }
}
