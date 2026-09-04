import { GameSceneV38 } from './GameSceneV38.js';
import { BLADE_TRACK_V27 } from './GameSceneV27.js';
import { TUNING } from './config.js';
import { COMBAT_V59, bladeSweepIntersectsAabbV59 } from './combatRulesV59.js';

// V59 replaces the original character-centered forward-range sword hitbox with
// collision driven by the blade root/tip anchors already authored for the live
// production attack sprites in V27. Damage now follows the visible sword rather
// than a rectangle in front of the player.
//
// Collision also sweeps between successive authored blade poses. That prevents
// a fast slash from tunneling through a target between rendered frames and keeps
// combat behavior stable when mobile frame pacing dips.

const VERSION='v59-blade-tracked-collision-20260904-1';
export const V59_CACHE_BUST=VERSION;

function clampStep(value){return Math.max(0,Math.min(2,Number(value)||0));}

function attackIsActiveV59(scene,time){
  const step=clampStep(scene?.comboStep);
  const start=Number(scene?.attackStartsAt);
  if(!Number.isFinite(start))return false;
  const elapsed=time-start;
  return elapsed>=(TUNING.attackActiveStartMs[step]||0)&&elapsed<=(TUNING.attackActiveEndMs[step]||0);
}

function attackActionV59(scene){
  // V38 deliberately presents the third attack while airborne. Keep collision
  // tied to that visible blade instead of the grounded combo pose underneath it.
  if(scene?.state?.startsWith?.('attack-')&&!scene?.player?.body?.blocked?.down)return'attack_3';
  const action=scene?.attackActionForStep?.(clampStep(scene?.comboStep));
  return BLADE_TRACK_V27[action]?action:`attack_${clampStep(scene?.comboStep)+1}`;
}

function attackFrameV59(scene,action,time){
  const direction=scene?.facing<0?'west':'east';
  const frame=scene?.attackFrame?.(action,direction,time);
  return Number.isFinite(frame)?Number(frame):-1;
}

function enemyBoundsV59(enemy){
  const body=enemy?.sprite?.body;
  if(body){
    const left=Number(body.left),right=Number(body.right),top=Number(body.top),bottom=Number(body.bottom);
    if([left,right,top,bottom].every(Number.isFinite))return{left,right,top,bottom};

    const x=Number(body.x),y=Number(body.y),width=Number(body.width),height=Number(body.height);
    if([x,y,width,height].every(Number.isFinite)&&width>0&&height>0){
      return{left:x,right:x+width,top:y,bottom:y+height};
    }
  }

  const x=Number(enemy?.sprite?.x),y=Number(enemy?.sprite?.y);
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  const halfWidth=enemy?.type==='boss1'?32:18;
  const halfHeight=enemy?.type==='boss1'?48:30;
  return{left:x-halfWidth,right:x+halfWidth,top:y-halfHeight,bottom:y+halfHeight};
}

function bladeSegmentV59(scene,action,frame){
  const anchor=BLADE_TRACK_V27[action]?.frames?.[frame];
  if(!anchor||typeof scene?.bladeWorldPointV27!=='function')return null;
  return{
    root:scene.bladeWorldPointV27(anchor.root),
    tip:scene.bladeWorldPointV27(anchor.tip),
  };
}

function resetBladeTrackingV59(scene){
  scene.v59BladeToken='';
  scene.v59BladeFrame=-1;
  scene.v59BladeSegment=null;
  scene.v59BladeAction='';
  scene.v59AttackHits=0;
}

const previousStartAttack=GameSceneV38.prototype.startAttack;
GameSceneV38.prototype.startAttack=function(time,step=null){
  const result=previousStartAttack.call(this,time,step);
  resetBladeTrackingV59(this);
  return result;
};

// This is the V59 combat change. The old updateAttack() used attackRanges plus a
// 64px vertical tolerance. The replacement below has no character-centered
// range fallback: if the authored blade sweep does not intersect the enemy body,
// the attack does not deal damage.
GameSceneV38.prototype.updateAttack=function(time){
  this.attackFlash?.setVisible?.(false);
  this.attackArc?.clear?.();
  this.attackArc?.setVisible?.(false);

  if(!attackIsActiveV59(this,time))return;

  const action=attackActionV59(this);
  const frame=attackFrameV59(this,action,time);
  const current=bladeSegmentV59(this,action,frame);
  this.v59BladeAction=action;
  this.v59BladeDisplayFrame=frame;
  if(!current)return;

  const token=`${Number(this.attackStartsAt)||0}:${action}`;
  if(token!==this.v59BladeToken){
    this.v59BladeToken=token;
    this.v59BladeFrame=-1;
    this.v59BladeSegment=null;
    this.v59AttackHits=0;
  }

  // Sweep only when the authored animation advances. Re-testing the same frame
  // uses the current blade segment alone so an enemy cannot walk into an old
  // historical sweep after the sword has already stopped there.
  const previous=this.v59BladeFrame!==frame?this.v59BladeSegment:null;
  const candidates=(this.enemies||[])
    .filter(enemy=>enemy?.alive&&!this.attackHitIds?.has?.(enemy.id))
    .map(enemy=>({enemy,bounds:enemyBoundsV59(enemy)}))
    .filter(entry=>entry.bounds&&bladeSweepIntersectsAabbV59(
      previous,
      current,
      entry.bounds,
      COMBAT_V59.bladeRadius,
      COMBAT_V59.sweepSamples,
    ))
    .sort((a,b)=>Math.abs((a.enemy.sprite?.x||0)-this.player.x)-Math.abs((b.enemy.sprite?.x||0)-this.player.x));

  const target=candidates[0]?.enemy;
  if(target){
    this.attackHitIds?.add?.(target.id);
    this.v59AttackHits=(this.v59AttackHits||0)+1;
    this.damageEnemy?.(target,clampStep(this.comboStep));
  }

  this.v59BladeFrame=frame;
  this.v59BladeSegment=current;
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const attacking=scene?.state?.startsWith?.('attack-');
  if(!attacking){
    marker.textContent='V59 • BLADE READY';
    return;
  }
  const action=scene?.v59BladeAction||attackActionV59(scene);
  const frame=Number.isFinite(scene?.v59BladeDisplayFrame)&&scene.v59BladeDisplayFrame>=0?` F${scene.v59BladeDisplayFrame}`:'';
  const hits=Number(scene?.v59AttackHits)||0;
  marker.textContent=`V59 • BLADE ${action}${frame} H${hits}`;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  resetBladeTrackingV59(this);
  setMarker(this);
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  setMarker(this);
};
