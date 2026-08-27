import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';
import { GameSceneV18, PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

// V53 calibrates death grounding from the actual V52 iPhone recording.
// V52 was moving the final death frame down by only ~6.5 world px, while the
// torso/arm still sat visibly above the stone because the sword is the lowest
// opaque part of the PNG. These offsets intentionally ground the BODY rather
// than the lowest weapon/cape pixel.

const VERSION='v53-death-body-grounding-20260827-1';
export const V53_CACHE_BUST=VERSION;
const PLAYER_FEET_Y=24;
const V17_ART_SCALE=.396;

export const PROTAGONIST_STATE_SCALE_V53=Object.freeze({
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

// Extra source-space contact offset for each death frame. At the live death
// scale (~0.461) the final 52px source bias becomes ~24 world px. That replaces
// V52's ~6.5px final correction and matches the visible body-to-floor gap in the
// submitted recording. The ramp keeps the early falling frames natural.
const DEATH_BODY_CONTACT_SOURCE_PX=Object.freeze([0,4,12,24,34,42,48,52]);

function actionFor(scene){
  const time=scene?.time?.now||0;
  let action='';
  try{action=scene?.resolvePixelState?.(time)||'';}catch(_){action='';}
  if(!action||action==='turning')action=scene?.visualAnimationState||'idle';
  return PROTAGONIST_STATE_SCALE_V53[action]!==undefined?action:'idle';
}

function factorFor(action){
  return PROTAGONIST_STATE_SCALE_V53[action]??1;
}

function currentFrameFor(scene,action){
  if(!action)return-1;
  const key=String(scene?.currentPixelKey||'');
  const match=key.match(new RegExp(`^px-${action}-(?:east|west)-(\\d{3})$`));
  return match?Number(match[1]):-1;
}

function deathBodySink(scene,action,targetScale){
  if(action!=='death')return 0;
  const frame=currentFrameFor(scene,action);
  if(frame<0)return 0;
  const sourcePx=DEATH_BODY_CONTACT_SOURCE_PX[Math.min(frame,DEATH_BODY_CONTACT_SOURCE_PX.length-1)]||0;
  return sourcePx*targetScale;
}

GameSceneV18.prototype.applyV18ArtScale=function(){
  if(!this.pixelArt||!this.player)return;

  // Recover the source frame's ordinary transparent-bottom padding from V17,
  // then apply the canonical V53 state scale. Death gets an additional body
  // contact offset because its sword extends below the prone character.
  const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
  const bottomPadding=Math.abs(V17_ART_SCALE)>1e-6?oldOffset/V17_ART_SCALE:0;
  const action=actionFor(this);
  const factor=factorFor(action);
  const targetScale=PROTAGONIST_ART_SCALE_V18*factor;
  const deathSink=deathBodySink(this,action,targetScale);

  this.pixelArt
    .setPosition(
      this.player.x,
      this.player.y+PLAYER_FEET_Y+bottomPadding*targetScale+deathSink,
    )
    .setScale(targetScale);

  this.v53VisualAction=action;
  this.v53VisualFactor=factor;
  this.v53VisualFrame=currentFrameFor(this,action);
  this.v53DeathSink=deathSink;
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const action=scene?.v53VisualAction||actionFor(scene);
  const factor=scene?.v53VisualFactor??factorFor(action);
  const grounded=scene?.player?.body?.blocked?.down?'G1':'G0';
  const frame=Number.isFinite(scene?.v53VisualFrame)&&scene.v53VisualFrame>=0?` F${scene.v53VisualFrame}`:'';
  const sink=scene?.v53DeathSink?` Y+${scene.v53DeathSink.toFixed(1)}`:'';
  marker.textContent=`V53 • BODY ${action} x${factor.toFixed(2)}${frame}${sink} ${grounded}`;
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
    if((this.v53MarkerTick=(this.v53MarkerTick||0)+1)%8===0)setMarker(this);
  }
};
