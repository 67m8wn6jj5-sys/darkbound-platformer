import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';
import { GameSceneV17 } from './GameSceneV17.js';
import { GameSceneV18, PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

// V51 is the canonical-size pass.
//
// The remaining size "pops" in the V50 recording were not all caused by the
// action PNGs. During a left/right change V17 briefly cycled through the eight
// rotation poses (front / back / diagonals). Those poses have very different
// silhouettes from the side-view run/idle frames, so the protagonist appeared
// to grow and shrink for a few frames even when the numerical scale was stable.
// A side-scroller does not need that 3-D turn cycle. V51 keeps the current
// side-view animation and changes direction directly, eliminating those large
// transient silhouettes.
//
// V50 also used total opaque area to infer scale. Total area is pose-sensitive:
// crouching, overlapping limbs, a spread cape, and a horizontal death pose all
// change area without changing the character's anatomical scale. V51 therefore
// returns to one canonical side-view scale and keeps only the two corrections
// that are visibly present in the source art: idle is slightly undersized and
// hit/death are slightly oversized. Gameplay/physics dimensions are untouched.

const VERSION='v51-canonical-protagonist-size-20260827-1';
export const V51_CACHE_BUST=VERSION;
const PLAYER_FEET_Y=24;
const V17_ART_SCALE=.396;

export const PROTAGONIST_STATE_SCALE_V51=Object.freeze({
  idle:1.10,
  run:1,
  jump:1,
  fall:1,
  land:1,
  dash:1,
  attack_1:1,
  attack_2:1,
  attack_3:1,
  hit:.95,
  death:.92,
});

function actionFor(scene){
  const time=scene?.time?.now||0;
  let action='';
  try{action=scene?.resolvePixelState?.(time)||'';}catch(_){action='';}
  if(!action||action==='turning')action=scene?.visualAnimationState||'idle';
  return PROTAGONIST_STATE_SCALE_V51[action]!==undefined?action:'idle';
}

function factorFor(action){
  return PROTAGONIST_STATE_SCALE_V51[action]??1;
}

// Eliminate the front/back/diagonal rotation frames from normal left/right
// movement. V17's updatePixelArt() will immediately choose the correct side
// animation when this returns false. This also removes any direction-specific
// scale correction: east and west now always use the same anatomical scale.
GameSceneV17.prototype.beginOrUpdateTurn=function(logicalDirection){
  this.visualDirection=logicalDirection;
  this.turnTargetDirection=logicalDirection;
  this.turning=false;
  this.nextTurnStepAt=0;
  return false;
};

// Reapply the final art scale after V17 has selected and grounded the current
// frame. Bottom padding is recovered from V17's fixed .396 source scale, then
// multiplied by the same target scale as the image so the boots remain on the
// exact same foot line.
GameSceneV18.prototype.applyV18ArtScale=function(){
  if(!this.pixelArt||!this.player)return;
  const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
  const bottomPadding=Math.abs(V17_ART_SCALE)>1e-6?oldOffset/V17_ART_SCALE:0;
  const action=actionFor(this);
  const factor=factorFor(action);
  const targetScale=PROTAGONIST_ART_SCALE_V18*factor;

  this.pixelArt
    .setPosition(
      this.player.x,
      this.player.y+PLAYER_FEET_Y+bottomPadding*targetScale,
    )
    .setScale(targetScale);

  this.v51VisualAction=action;
  this.v51VisualFactor=factor;
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const action=scene?.v51VisualAction||actionFor(scene);
  const factor=scene?.v51VisualFactor??factorFor(action);
  const grounded=scene?.player?.body?.blocked?.down?'G1':'G0';
  marker.textContent=`V51 • LOCK ${action} x${factor.toFixed(2)} ${grounded}`;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  setMarker(this);
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  if(this.environmentLayout?.grammar===CATHEDRAL_V38.grammar){
    if((this.v51MarkerTick=(this.v51MarkerTick||0)+1)%12===0)setMarker(this);
  }
};
