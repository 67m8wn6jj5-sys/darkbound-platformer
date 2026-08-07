import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';

export class GameSceneV05 extends GameScene {
  preload(){
    this.load.svg('darkbound-protagonist','./assets/protagonist-body.svg',{width:96,height:128});
    this.load.svg('darkbound-sword','./assets/protagonist-sword.svg',{width:96,height:24});
  }

  create(){
    super.create();
    this.attackFlash.setAlpha(.12);
  }

  createPlayer(x,y){
    const p=this.add.container(x,y);
    const shadow=this.add.ellipse(0,25,48,11,0x000000,.48);
    const aura=this.add.ellipse(0,6,38,70,0x68ff72,.035).setStrokeStyle(1,0x72ff58,.12);
    const art=this.add.image(0,-15,'darkbound-protagonist').setDisplaySize(67,90).setOrigin(.5,.5);
    const sword=this.add.image(16,1,'darkbound-sword').setDisplaySize(67,17).setOrigin(.08,.5);

    p.add([shadow,aura,art,sword]);
    p.weapon=sword;
    p.art=art;
    p.aura=aura;
    // Preserve the v0.4 movement code without stretching the whole character as a cape proxy.
    p.cape={setScale(){return this;}};

    this.physics.add.existing(p);
    p.body
      .setSize(28,54)
      .setOffset(-14,-30)
      .setCollideWorldBounds(true)
      .setMaxVelocity(TUNING.rollSpeed,TUNING.maxFallSpeed);
    return p;
  }

  drawAttackArc(active,step){
    this.attackArc.clear();
    this.attackArc.setVisible(active);
    if(!active)return;
    const radius=[43,51,63][step];
    const start=this.facing>0?-0.72:Math.PI+0.72;
    const end=this.facing>0?0.68:Math.PI-0.68;
    this.attackArc.lineStyle(step===2?4:3,step===2?0xaaff32:0x73ff28,step===2?.95:.9);
    this.attackArc.beginPath();
    this.attackArc.arc(this.player.x,this.player.y-3,radius,start,end,this.facing<0);
    this.attackArc.strokePath();
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.player?.art)return;

    const art=this.player.art;
    const aura=this.player.aura;
    const speed=Math.abs(this.player.body?.velocity?.x||0);
    const phase=time*.012;

    let y=-15;
    let angle=0;
    let sx=1;
    let sy=1;

    if(this.state==='idle'){
      y+=Math.sin(phase)*1.1;
      sy=1+Math.sin(phase)*.012;
    } else if(this.state==='running'){
      y+=Math.abs(Math.sin(phase*1.75))*1.8;
      angle=Math.sin(phase*1.75)*1.8;
      sx=1.015;
      sy=.985;
    } else if(this.state==='rising'){
      angle=-3.5;
      sx=.98;
      sy=1.025;
    } else if(this.state==='falling'){
      angle=3;
      sx=1.025;
      sy=.98;
    } else if(this.state==='rolling'){
      angle=(time%260)/260*360*this.facing;
      sx=1.05;
      sy=.86;
      y=-9;
    } else if(this.state?.startsWith('attack-')){
      const step=this.comboStep||0;
      angle=[-4,3,-8][step];
      sx=1.03+(step*.015);
      sy=.985;
    } else if(this.state==='dead'){
      angle=82;
      y=-4;
    }

    art.setPosition(0,y).setAngle(angle).setScale(sx,sy);
    aura.setAlpha(.025+Math.min(.045,speed/7000)+Math.sin(time*.005)*.008);

    if(this.debug?.text?.includes('v0.4.0')){
      this.debug.setText(this.debug.text.replace('v0.4.0','v0.5.0 ART PASS 1'));
    }
  }
}
