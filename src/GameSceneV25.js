import { GameSceneV24 } from './GameSceneV24.js';

const VFX_GREEN=0x43ff57;
const VFX_GREEN_HOT=0xbfff8f;
const VFX_GREEN_CORE=0xf2ffe1;

export const SWORD_VFX_V25=Object.freeze({
  attack_1:Object.freeze({
    frames:Object.freeze([2,3,4,5]),
    centerX:20,centerY:-44,radius:76,width:8,
    startDeg:-30,endDeg:20,sliceDeg:34,
    particles:3,particleX:28,particleY:3,particleSpreadX:10,particleSpreadY:10,
    lifeMs:105,
  }),
  attack_2:Object.freeze({
    frames:Object.freeze([2,3,4,5]),
    centerX:18,centerY:-38,radius:82,width:9,
    startDeg:58,endDeg:-82,sliceDeg:42,
    particles:4,particleX:8,particleY:-34,particleSpreadX:10,particleSpreadY:12,
    lifeMs:125,
  }),
  attack_3:Object.freeze({
    frames:Object.freeze([3,4,5,6,7]),
    centerX:15,centerY:-50,radius:96,width:12,
    startDeg:-96,endDeg:54,sliceDeg:50,
    particles:6,particleX:34,particleY:18,particleSpreadX:16,particleSpreadY:14,
    lifeMs:155,
  }),
});

export function resolveSwordStep(time,comboExpiresAt,comboStep,requestedStep=null){
  if(requestedStep!==null&&requestedStep!==undefined){
    return Math.max(0,Math.min(2,Number(requestedStep)||0));
  }
  if(time<=comboExpiresAt)return (Math.max(0,Math.min(2,Number(comboStep)||0))+1)%3;
  return 0;
}

function deg(value){return value*Math.PI/180;}
function lerp(a,b,t){return a+(b-a)*t;}

export class GameSceneV25 extends GameSceneV24 {
  startAttack(time,step=null){
    const resolvedStep=resolveSwordStep(time,this.comboExpiresAt,this.comboStep,step);
    super.startAttack(time,resolvedStep);
  }

  emitAttackMotionFx(action,frame,time){
    const profile=SWORD_VFX_V25[action];
    if(!profile)return;
    const frameIndex=profile.frames.indexOf(frame);
    if(frameIndex<0)return;

    const token=`v25:${this.attackStartsAt}:${action}:${frame}`;
    if(token===this.lastAttackFxToken)return;
    this.lastAttackFxToken=token;

    const facing=this.facing<0?-1:1;
    const progress=profile.frames.length<=1?1:frameIndex/(profile.frames.length-1);
    const angle=lerp(profile.startDeg,profile.endDeg,progress);
    const sweepDirection=profile.endDeg>=profile.startDeg?1:-1;
    const arcStart=angle-sweepDirection*profile.sliceDeg*.72;
    const arcEnd=angle+sweepDirection*profile.sliceDeg*.28;
    const radius=profile.radius;
    const centerX=this.player.x+facing*profile.centerX;
    const centerY=this.player.y+profile.centerY;

    const trail=this.add.graphics().setPosition(centerX,centerY).setDepth(111).setBlendMode(Phaser.BlendModes.ADD);
    trail.setScale(facing,1);
    const layers=[
      {radius:radius+3,width:profile.width*2.35,color:VFX_GREEN,alpha:.16},
      {radius:radius+1,width:profile.width*1.25,color:VFX_GREEN_HOT,alpha:.48},
      {radius,width:Math.max(2,profile.width*.48),color:VFX_GREEN_CORE,alpha:.92},
    ];
    for(const layer of layers){
      trail.lineStyle(layer.width,layer.color,layer.alpha);
      trail.beginPath();
      trail.arc(0,0,layer.radius,deg(arcStart),deg(arcEnd),sweepDirection<0);
      trail.strokePath();
    }
    this.tweens.add({
      targets:trail,
      alpha:0,
      duration:profile.lifeMs,
      ease:'Quad.easeOut',
      onComplete:()=>trail.destroy(),
    });

    const angleRad=deg(angle);
    const tipX=centerX+facing*Math.cos(angleRad)*radius;
    const tipY=centerY+Math.sin(angleRad)*radius;
    const particleCount=profile.particles+(frameIndex===profile.frames.length-1?2:0);
    for(let i=0;i<particleCount;i++){
      const size=Phaser.Math.Between(1,action==='attack_3'?4:3);
      const particle=this.add.circle(
        tipX+Phaser.Math.Between(-3,3),
        tipY+Phaser.Math.Between(-3,3),
        size,
        i%3===0?VFX_GREEN_CORE:VFX_GREEN_HOT,
        .92
      ).setDepth(114).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:particle,
        x:particle.x+facing*(profile.particleX+Phaser.Math.Between(-profile.particleSpreadX,profile.particleSpreadX)),
        y:particle.y+profile.particleY+Phaser.Math.Between(-profile.particleSpreadY,profile.particleSpreadY),
        alpha:0,
        scale:.08,
        duration:Phaser.Math.Between(profile.lifeMs*.75,profile.lifeMs*1.25),
        ease:'Quad.easeOut',
        onComplete:()=>particle.destroy(),
      });
    }

    if(action==='attack_3'&&frame===6){
      const pulse=this.add.circle(tipX,tipY,5,VFX_GREEN_CORE,.18)
        .setStrokeStyle(3,VFX_GREEN_HOT,.75)
        .setDepth(112)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:pulse,
        scale:3.2,
        alpha:0,
        duration:145,
        ease:'Cubic.easeOut',
        onComplete:()=>pulse.destroy(),
      });
    }
  }
}
