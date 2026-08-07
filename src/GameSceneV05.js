import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';

const FRAME_SIZE = 128;
const FRAMES_PER_ROW = 8;

const SEQUENCES = Object.freeze({
  idle:    { row:0, frames:7, frameRate:6,  repeat:-1 },
  run:     { row:1, frames:7, frameRate:14, repeat:-1 },
  jump:    { row:2, frames:6, frameRate:10, repeat:0 },
  attack1: { row:3, frames:7, frameRate:36, repeat:0 },
  attack2: { row:4, frames:7, frameRate:33, repeat:0 },
  attack3: { row:5, frames:8, frameRate:29, repeat:0 },
  roll:    { row:6, frames:8, frameRate:21, repeat:0 },
  hit:     { row:7, frames:8, frameRate:30, repeat:0 },
  death:   { row:8, frames:8, frameRate:12, repeat:0 }
});

export class GameSceneV05 extends GameScene {
  preload(){
    this.load.spritesheet('v05-protagonist','./assets/v05/protagonist-atlas.png',{
      frameWidth:FRAME_SIZE,
      frameHeight:FRAME_SIZE
    });
  }

  create(){
    super.create();
    this.installProtagonistAnimations();
    this.hitAnimEndsAt=0;
    this.wasGrounded=true;
    this.landingAnimEndsAt=0;
    this.attackFlash.setAlpha(.08);
    this.player.art.play('v05-anim-idle');
  }

  installProtagonistAnimations(){
    Object.entries(SEQUENCES).forEach(([name,sequence])=>{
      const key=`v05-anim-${name}`;
      if(this.anims.exists(key))return;
      const start=sequence.row*FRAMES_PER_ROW;
      this.anims.create({
        key,
        frames:this.anims.generateFrameNumbers('v05-protagonist',{
          start,
          end:start+sequence.frames-1
        }),
        frameRate:sequence.frameRate,
        repeat:sequence.repeat
      });
    });
  }

  createPlayer(x,y){
    const p=this.add.container(x,y);
    const shadow=this.add.ellipse(0,25,48,11,0x000000,.44);
    const aura=this.add.ellipse(0,4,42,74,0x69ff52,.025)
      .setStrokeStyle(1,0x76ff42,.10);
    const art=this.add.sprite(0,-27,'v05-protagonist',0)
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

  playProtagonist(name){
    const key=`v05-anim-${name}`;
    if(!this.anims.exists(key))return;
    if(this.player.art.anims.currentAnim?.key===key && this.player.art.anims.isPlaying)return;
    this.player.art.play(key,true);
  }

  damagePlayer(time,enemy){
    const hpBefore=this.playerHp;
    super.damagePlayer(time,enemy);
    if(this.playerHp<hpBefore && !this.dead)this.hitAnimEndsAt=time+250;
  }

  killPlayer(){
    super.killPlayer();
    this.player.art?.play('v05-anim-death',true);
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

  update(time,delta){
    super.update(time,delta);
    if(!this.player?.art)return;

    const art=this.player.art;
    const body=this.player.body;
    const grounded=!!body?.blocked?.down;
    art.setPosition(0,-27).setDisplaySize(96,96);
    this.player.aura.setAlpha(.02+Math.min(.04,Math.abs(body?.velocity?.x||0)/8000));

    if(this.dead){
      if(art.anims.currentAnim?.key!=='v05-anim-death')art.play('v05-anim-death',true);
    } else if(time<this.hitAnimEndsAt){
      this.playProtagonist('hit');
    } else if(this.state==='rolling'){
      this.playProtagonist('roll');
    } else if(this.state?.startsWith('attack-')){
      this.playProtagonist(['attack1','attack2','attack3'][this.comboStep]||'attack1');
    } else if(!grounded){
      const jumpFrame=body.velocity.y<-260?1:(body.velocity.y<80?2:(body.velocity.y<420?3:4));
      art.anims.stop();
      art.setFrame((SEQUENCES.jump.row*FRAMES_PER_ROW)+jumpFrame);
    } else if(!this.wasGrounded){
      this.landingAnimEndsAt=time+95;
      art.anims.stop();
      art.setFrame((SEQUENCES.jump.row*FRAMES_PER_ROW)+5);
    } else if(time<this.landingAnimEndsAt){
      art.anims.stop();
      art.setFrame((SEQUENCES.jump.row*FRAMES_PER_ROW)+5);
    } else if(this.state==='running'){
      this.playProtagonist('run');
    } else {
      this.playProtagonist('idle');
    }

    this.wasGrounded=grounded;

    if(this.debug?.text){
      this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.5.1 PRODUCTION'));
    }
  }
}
