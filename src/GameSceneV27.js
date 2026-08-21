import { GameSceneV26 } from './GameSceneV26.js';
import { PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

const PLAYER_FEET_Y=24;
const VFX_GREEN=0x43ff57;
const VFX_GREEN_HOT=0xbfff8f;

// Source-space blade root/tip anchors authored against the production sprite.
// Unlike the old character-centered arcs, V27 draws only on the blade itself
// and derives mote motion from the tip's frame-to-frame tangent.
export const BLADE_TRACK_V27=Object.freeze({
  attack_1:Object.freeze({
    outerAlpha:.065,innerAlpha:.16,outerWidth:2.2,innerWidth:.9,lifeMs:62,moteAlpha:.16,moteLifeMs:58,moteDrift:10,
    moteFrames:Object.freeze([3,4]),
    frames:Object.freeze({
      2:Object.freeze({root:Object.freeze([16,-58]),tip:Object.freeze([76,-86])}),
      3:Object.freeze({root:Object.freeze([18,-58]),tip:Object.freeze([94,-72])}),
      4:Object.freeze({root:Object.freeze([20,-56]),tip:Object.freeze([108,-48])}),
      5:Object.freeze({root:Object.freeze([18,-52]),tip:Object.freeze([116,-24])}),
    }),
  }),
  attack_2:Object.freeze({
    outerAlpha:.07,innerAlpha:.17,outerWidth:2.3,innerWidth:.95,lifeMs:66,moteAlpha:.17,moteLifeMs:62,moteDrift:10,
    moteFrames:Object.freeze([3,4,5]),
    frames:Object.freeze({
      2:Object.freeze({root:Object.freeze([16,-46]),tip:Object.freeze([80,-18])}),
      3:Object.freeze({root:Object.freeze([18,-52]),tip:Object.freeze([82,-56])}),
      4:Object.freeze({root:Object.freeze([20,-56]),tip:Object.freeze([68,-94])}),
      5:Object.freeze({root:Object.freeze([20,-58]),tip:Object.freeze([46,-114])}),
    }),
  }),
  attack_3:Object.freeze({
    outerAlpha:.075,innerAlpha:.18,outerWidth:2.5,innerWidth:1,lifeMs:72,moteAlpha:.18,moteLifeMs:68,moteDrift:12,
    moteFrames:Object.freeze([4,5,6]),
    frames:Object.freeze({
      3:Object.freeze({root:Object.freeze([18,-62]),tip:Object.freeze([38,-118])}),
      4:Object.freeze({root:Object.freeze([20,-60]),tip:Object.freeze([76,-104])}),
      5:Object.freeze({root:Object.freeze([22,-56]),tip:Object.freeze([106,-66])}),
      6:Object.freeze({root:Object.freeze([22,-50]),tip:Object.freeze([116,-20])}),
    }),
  }),
});

function frameNumbers(profile){
  return Object.keys(profile?.frames||{}).map(Number).sort((a,b)=>a-b);
}

export function bladeTangentV27(action,frame){
  const profile=BLADE_TRACK_V27[action];
  const current=profile?.frames?.[frame];
  if(!current)return{x:0,y:0};
  const numbers=frameNumbers(profile);
  const index=numbers.indexOf(Number(frame));
  const previous=index>0?profile.frames[numbers[index-1]]:null;
  if(previous){
    return{x:current.tip[0]-previous.tip[0],y:current.tip[1]-previous.tip[1]};
  }
  return{x:current.tip[0]-current.root[0],y:current.tip[1]-current.root[1]};
}

function lerpPoint(a,b,t){
  return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}

function normalize(x,y){
  const length=Math.hypot(x,y)||1;
  return{x:x/length,y:y/length};
}

export class GameSceneV27 extends GameSceneV26 {
  bladeWorldPointV27(point){
    const facing=this.facing<0?-1:1;
    return{
      x:this.player.x+facing*point[0]*PROTAGONIST_ART_SCALE_V18,
      y:this.player.y+PLAYER_FEET_Y+point[1]*PROTAGONIST_ART_SCALE_V18,
    };
  }

  emitAttackMotionFx(action,frame,time){
    const profile=BLADE_TRACK_V27[action];
    const anchor=profile?.frames?.[frame];
    if(!profile||!anchor)return;

    const token=`v27:${this.attackStartsAt}:${action}:${frame}`;
    if(token===this.lastAttackFxToken)return;
    this.lastAttackFxToken=token;

    const root=this.bladeWorldPointV27(anchor.root);
    const tip=this.bladeWorldPointV27(anchor.tip);
    const distal=lerpPoint(root,tip,.44);
    const trail=this.add.graphics().setDepth(111).setBlendMode(Phaser.BlendModes.ADD);

    trail.lineStyle(profile.outerWidth,VFX_GREEN,profile.outerAlpha);
    trail.beginPath();
    trail.moveTo(distal.x,distal.y);
    trail.lineTo(tip.x,tip.y);
    trail.strokePath();
    trail.lineStyle(profile.innerWidth,VFX_GREEN_HOT,profile.innerAlpha);
    trail.beginPath();
    trail.moveTo(lerpPoint(root,tip,.57).x,lerpPoint(root,tip,.57).y);
    trail.lineTo(tip.x,tip.y);
    trail.strokePath();

    const numbers=frameNumbers(profile);
    const index=numbers.indexOf(Number(frame));
    if(index>0){
      const previous=profile.frames[numbers[index-1]];
      const previousTip=this.bladeWorldPointV27(previous.tip);
      const arcTrace=this.add.graphics().setDepth(110).setBlendMode(Phaser.BlendModes.ADD);
      arcTrace.lineStyle(1,VFX_GREEN,.075);
      arcTrace.beginPath();
      arcTrace.moveTo(previousTip.x,previousTip.y);
      arcTrace.lineTo(tip.x,tip.y);
      arcTrace.strokePath();
      this.tweens.add({targets:arcTrace,alpha:0,duration:Math.max(44,profile.lifeMs-12),ease:'Quad.easeOut',onComplete:()=>arcTrace.destroy()});
    }

    this.tweens.add({targets:trail,alpha:0,duration:profile.lifeMs,ease:'Quad.easeOut',onComplete:()=>trail.destroy()});

    if(!profile.moteFrames.includes(frame))return;
    const facing=this.facing<0?-1:1;
    const tangent=bladeTangentV27(action,frame);
    const direction=normalize(facing*tangent.x,tangent.y);
    const moteStart=lerpPoint(root,tip,.88);
    const drift=profile.moteDrift*PROTAGONIST_ART_SCALE_V18;
    const mote=this.add.circle(moteStart.x,moteStart.y,1.1,VFX_GREEN_HOT,profile.moteAlpha)
      .setDepth(112).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets:mote,
      x:mote.x+direction.x*drift,
      y:mote.y+direction.y*drift,
      alpha:0,
      scale:.45,
      duration:profile.moteLifeMs,
      ease:'Quad.easeOut',
      onComplete:()=>mote.destroy(),
    });
  }
}
