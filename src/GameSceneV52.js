import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';
import { GameSceneV18, PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

// V52 tightens the last two visible inconsistencies from the V51 recording.
// Hit is still slightly oversized relative to run/jump/attack, so it receives a
// further 5% reduction. Death needs a different kind of correction: the source
// frames include sword/cape pixels below the torso, so aligning the lowest
// opaque pixel to the floor leaves the horizontal body visibly hovering.
// We therefore add a small progressive body-contact sink across the death
// sequence while keeping the normal frame-bottom-padding grounding logic.

const VERSION='v52-hit-death-contact-20260827-1';
export const V52_CACHE_BUST=VERSION;
const PLAYER_FEET_Y=24;
const V17_ART_SCALE=.396;

export const PROTAGONIST_STATE_SCALE_V52=Object.freeze({
  idle:1.10,
  run:1,
  jump:1,
  fall:1,
  land:1,
  dash:1,
  attack_1:1,
  attack_2:1,
  attack_3:1,
  hit:.90,
  death:.92,
});

// Source-pixel bias applied after the ordinary transparent-bottom-padding
// correction. It ramps in only as the death pose becomes horizontal so the
// standing/falling portion of the animation is not pushed into the floor.
const DEATH_CONTACT_SINK_SOURCE_PX=Object.freeze([0,0,2,6,10,12,14,14]);

function actionFor(scene){
  const time=scene?.time?.now||0;
  let action='';
  try{action=scene?.resolvePixelState?.(time)||'';}catch(_){action='';}
  if(!action||action==='turning')action=scene?.visualAnimationState||'idle';
  return PROTAGONIST_STATE_SCALE_V52[action]!==undefined?action:'idle';
}

function factorFor(action){
  return PROTAGONIST_STATE_SCALE_V52[action]??1;
}

function currentFrameFor(scene,action){
  if(!action)return-1;
  const key=String(scene?.currentPixelKey||'');
  const match=key.match(new RegExp(`^px-${action}-(?:east|west)-(\\d{3})$`));
  return match?Number(match[1]):-1;
}

function deathSinkFor(scene,action,targetScale){
  if(action!=='death')return 0;
  const frame=currentFrameFor(scene,action);
  if(frame<0)return 0;
  const sourcePx=DEATH_CONTACT_SINK_SOURCE_PX[Math.min(frame,DEATH_CONTACT_SINK_SOURCE_PX.length-1)]||0;
  return sourcePx*targetScale;
}

GameSceneV18.prototype.applyV18ArtScale=function(){
  if(!this.pixelArt||!this.player)return;

  // V17 has already selected the frame and positioned it using its .396 scale.
  // Recover the source-frame transparent bottom padding, then reapply it using
  // the final canonical scale so all upright animations keep the same foot line.
  const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
  const bottomPadding=Math.abs(V17_ART_SCALE)>1e-6?oldOffset/V17_ART_SCALE:0;
  const action=actionFor(this);
  const factor=factorFor(action);
  const targetScale=PROTAGONIST_ART_SCALE_V18*factor;
  const deathSink=deathSinkFor(this,action,targetScale);

  this.pixelArt
    .setPosition(
      this.player.x,
      this.player.y+PLAYER_FEET_Y+bottomPadding*targetScale+deathSink,
    )
    .setScale(targetScale);

  this.v52VisualAction=action;
  this.v52VisualFactor=factor;
  this.v52VisualFrame=currentFrameFor(this,action);
  this.v52DeathSink=deathSink;
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const action=scene?.v52VisualAction||actionFor(scene);
  const factor=scene?.v52VisualFactor??factorFor(action);
  const grounded=scene?.player?.body?.blocked?.down?'G1':'G0';
  const frame=Number.isFinite(scene?.v52VisualFrame)&&scene.v52VisualFrame>=0?` F${scene.v52VisualFrame}`:'';
  const sink=scene?.v52DeathSink?` Y+${scene.v52DeathSink.toFixed(1)}`:'';
  marker.textContent=`V52 • CONTACT ${action} x${factor.toFixed(2)}${frame}${sink} ${grounded}`;
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
    if((this.v52MarkerTick=(this.v52MarkerTick||0)+1)%12===0)setMarker(this);
  }
};
