import { GameSceneV25 } from './GameSceneV25.js';

const VFX_GREEN=0x43ff57;
const VFX_GREEN_HOT=0xbfff8f;

// V26 intentionally keeps sword VFX subordinate to the sprite animation.
// Each attack gets a different path, but the effect is only a faint blade
// afterimage plus one or two tiny sparks at the strongest contact frame.
export const SWORD_VFX_V26=Object.freeze({
  attack_1:Object.freeze({
    frames:Object.freeze([2,3,4,5]),
    centerX:20,centerY:-44,radius:74,
    startDeg:-28,endDeg:18,sliceDeg:24,
    outerWidth:3,innerWidth:1.25,
    outerAlpha:.075,innerAlpha:.22,
    lifeMs:78,sparkFrame:4,sparks:1,
  }),
  attack_2:Object.freeze({
    frames:Object.freeze([2,3,4,5]),
    centerX:18,centerY:-38,radius:80,
    startDeg:56,endDeg:-80,sliceDeg:28,
    outerWidth:3.25,innerWidth:1.4,
    outerAlpha:.08,innerAlpha:.24,
    lifeMs:86,sparkFrame:4,sparks:1,
  }),
  attack_3:Object.freeze({
    frames:Object.freeze([3,4,5,6,7]),
    centerX:15,centerY:-50,radius:92,
    startDeg:-92,endDeg:50,sliceDeg:32,
    outerWidth:4,innerWidth:1.6,
    outerAlpha:.085,innerAlpha:.26,
    lifeMs:98,sparkFrame:6,sparks:2,
  }),
});

function deg(value){return value*Math.PI/180;}
function lerp(a,b,t){return a+(b-a)*t;}

export class GameSceneV26 extends GameSceneV25 {
  emitAttackMotionFx(action,frame,time){
    const profile=SWORD_VFX_V26[action];
    if(!profile)return;
    const frameIndex=profile.frames.indexOf(frame);
    if(frameIndex<0)return;

    const token=`v26:${this.attackStartsAt}:${action}:${frame}`;
    if(token===this.lastAttackFxToken)return;
    this.lastAttackFxToken=token;

    const facing=this.facing<0?-1:1;
    const progress=profile.frames.length<=1?1:frameIndex/(profile.frames.length-1);
    const angle=lerp(profile.startDeg,profile.endDeg,progress);
    const sweepDirection=profile.endDeg>=profile.startDeg?1:-1;
    const arcStart=angle-sweepDirection*profile.sliceDeg*.68;
    const arcEnd=angle+sweepDirection*profile.sliceDeg*.32;
    const centerX=this.player.x+facing*profile.centerX;
    const centerY=this.player.y+profile.centerY;

    const trail=this.add.graphics()
      .setPosition(centerX,centerY)
      .setDepth(110)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(facing,1);

    trail.lineStyle(profile.outerWidth,VFX_GREEN,profile.outerAlpha);
    trail.beginPath();
    trail.arc(0,0,profile.radius+1,deg(arcStart),deg(arcEnd),sweepDirection<0);
    trail.strokePath();
    trail.lineStyle(profile.innerWidth,VFX_GREEN_HOT,profile.innerAlpha);
    trail.beginPath();
    trail.arc(0,0,profile.radius,deg(arcStart),deg(arcEnd),sweepDirection<0);
    trail.strokePath();

    this.tweens.add({
      targets:trail,
      alpha:0,
      duration:profile.lifeMs,
      ease:'Quad.easeOut',
      onComplete:()=>trail.destroy(),
    });

    if(frame!==profile.sparkFrame)return;
    const tipAngle=deg(angle);
    const tipX=centerX+facing*Math.cos(tipAngle)*profile.radius;
    const tipY=centerY+Math.sin(tipAngle)*profile.radius;
    for(let i=0;i<profile.sparks;i++){
      const spark=this.add.circle(
        tipX+Phaser.Math.Between(-2,2),
        tipY+Phaser.Math.Between(-2,2),
        Phaser.Math.Between(1,2),
        VFX_GREEN_HOT,
        .38
      ).setDepth(112).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:spark,
        x:spark.x+facing*Phaser.Math.Between(5,10),
        y:spark.y+Phaser.Math.Between(-5,5),
        alpha:0,
        scale:.2,
        duration:Phaser.Math.Between(70,105),
        ease:'Quad.easeOut',
        onComplete:()=>spark.destroy(),
      });
    }
  }
}
