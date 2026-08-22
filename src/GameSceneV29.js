import { GameSceneV28 } from './GameSceneV28.js';
import { BLADE_TRACK_V27 } from './GameSceneV27.js';
import { PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const VFX_GREEN=0x43ff57;
const VFX_GREEN_HOT=0xbfff8f;

function sourceDirection(meta,direction){
  if(direction==='west'&&meta?.mirrorWest)return meta.mirrorSourceDirection||'east';
  if(direction==='east'&&meta?.mirrorEast)return meta.mirrorSourceDirection||'west';
  return direction;
}

function frameCount(action,direction){
  const meta=PIXELLAB_MANIFEST[action];
  const source=sourceDirection(meta,direction);
  return Math.max(1,Number(meta?.[source])||1);
}

function lerpPoint(a,b,t){
  return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}

function normalize(x,y){
  const length=Math.hypot(x,y)||1;
  return{x:x/length,y:y/length};
}

// V29 turns the awkward attack-1 pullback into an intentional thrust by
// playing the exact approved sprite sequence backward. The other two attacks
// keep their existing frame order and all gameplay timing remains unchanged.
export function reverseAttackFrameV29(action,direction,forwardFrame){
  if(action!=='attack_1')return forwardFrame;
  const count=frameCount(action,direction);
  const clamped=Math.max(0,Math.min(count-1,Number(forwardFrame)||0));
  return count-1-clamped;
}

// V27's blade anchors remain correct for each individual sprite frame, but its
// history assumes frames advance numerically. attack_1 now runs downward, so
// the actual previous tracked frame is frame+1.
export function reversedBladeTangentV29(frame){
  const profile=BLADE_TRACK_V27.attack_1;
  const current=profile?.frames?.[frame];
  if(!current)return{x:0,y:0};
  const previous=profile.frames?.[Number(frame)+1];
  if(previous){
    return{x:current.tip[0]-previous.tip[0],y:current.tip[1]-previous.tip[1]};
  }
  return{x:current.tip[0]-current.root[0],y:current.tip[1]-current.root[1]};
}

export class GameSceneV29 extends GameSceneV28 {
  attackFrame(action,direction,time){
    const forwardFrame=super.attackFrame(action,direction,time);
    return reverseAttackFrameV29(action,direction,forwardFrame);
  }

  emitAttackMotionFx(action,frame,time){
    if(action!=='attack_1'){
      super.emitAttackMotionFx(action,frame,time);
      return;
    }

    const profile=BLADE_TRACK_V27.attack_1;
    const anchor=profile?.frames?.[frame];
    if(!profile||!anchor)return;

    const token=`v29:${this.attackStartsAt}:${action}:${frame}`;
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
    const inner=lerpPoint(root,tip,.57);
    trail.moveTo(inner.x,inner.y);
    trail.lineTo(tip.x,tip.y);
    trail.strokePath();

    const previous=profile.frames?.[Number(frame)+1];
    if(previous){
      const previousTip=this.bladeWorldPointV27(previous.tip);
      const trace=this.add.graphics().setDepth(110).setBlendMode(Phaser.BlendModes.ADD);
      trace.lineStyle(1,VFX_GREEN,.075);
      trace.beginPath();
      trace.moveTo(previousTip.x,previousTip.y);
      trace.lineTo(tip.x,tip.y);
      trace.strokePath();
      this.tweens.add({
        targets:trace,
        alpha:0,
        duration:Math.max(44,profile.lifeMs-12),
        ease:'Quad.easeOut',
        onComplete:()=>trace.destroy(),
      });
    }

    this.tweens.add({
      targets:trail,
      alpha:0,
      duration:profile.lifeMs,
      ease:'Quad.easeOut',
      onComplete:()=>trail.destroy(),
    });

    if(!profile.moteFrames.includes(frame))return;
    const facing=this.facing<0?-1:1;
    const tangent=reversedBladeTangentV29(frame);
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
