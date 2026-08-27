import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';
import { GameSceneV18, PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

// V50 replaces the coarse V49 state guesses with measurements taken from the
// actual production PNGs. The screen recording made the problem especially
// obvious in the hit reaction: the physics/body scale stayed constant while
// the artwork itself jumped much larger.
//
// For each production action we measured the median number of opaque pixels in
// its source frames. Because visible area changes approximately with scale^2,
// sqrt(referenceArea / actionArea) gives a useful anatomical scale correction.
// Run/east is the visual reference. This keeps the correction data-driven and
// avoids compensating by eye for one frame while making another state worse.

const VERSION='v50-measured-protagonist-scale-20260827-1';
export const V50_CACHE_BUST=VERSION;
const PLAYER_FEET_Y=24;

// Measured from the live production assets (alpha >= 32), referenced to the
// east run median. Values are intentionally rounded to three decimals.
export const PROTAGONIST_STATE_SCALE_V50=Object.freeze({
  idle:1.127,
  run:1.000,
  jump:.977,
  fall:.943,
  land:.908,
  dash:1.010,
  attack_1:1.001,
  attack_2:.974,
  attack_3:.952,
  hit:.817,
  death:.853,
});

// The west run source set is about 9% larger in opaque area than east, even
// though the other east/west production sets are effectively matched.
const RUN_WEST_DIRECTION_SCALE=.958;

function actionFor(scene){
  const time=scene?.time?.now||0;
  let action='';
  try{action=scene?.resolvePixelState?.(time)||'';}catch(_){action='';}
  if(!action||action==='turning')action=scene?.visualAnimationState||'idle';
  return action;
}

function scaleFactorFor(scene,action=actionFor(scene)){
  let factor=PROTAGONIST_STATE_SCALE_V50[action]||1;
  if(action==='run'&&scene?.facing<0)factor*=RUN_WEST_DIRECTION_SCALE;
  return factor;
}

// V17 has just placed the current frame using its frame-specific transparent
// bottom padding. Recover that padding at the source scale, then apply the V50
// measured scale to both the image and padding. The boot/ground contact point
// therefore stays fixed while the anatomical size changes.
GameSceneV18.prototype.applyV18ArtScale=function(){
  if(!this.pixelArt||!this.player)return;
  const sourceScale=Math.abs(Number(this.pixelArt.scaleY))||1;
  const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
  const bottomPadding=sourceScale>1e-6?oldOffset/sourceScale:0;
  const action=actionFor(this);
  const targetScale=PROTAGONIST_ART_SCALE_V18*scaleFactorFor(this,action);
  this.pixelArt
    .setPosition(
      this.player.x,
      this.player.y+PLAYER_FEET_Y+bottomPadding*targetScale,
    )
    .setScale(targetScale);
  this.v50VisualAction=action;
  this.v50VisualScale=targetScale;
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const player=scene?.player;
  const grounded=player?.body?.blocked?.down?'G1':'G0';
  const action=scene?.v50VisualAction||actionFor(scene);
  const factor=scaleFactorFor(scene,action);
  marker.textContent=`V50 • SCALE ${action} x${factor.toFixed(3)} ${grounded}`;
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
    if((this.v50MarkerTick=(this.v50MarkerTick||0)+1)%12===0)setMarker(this);
  }
};
