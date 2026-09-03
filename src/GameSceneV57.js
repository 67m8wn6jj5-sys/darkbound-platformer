import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';
import { GameSceneV18, PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

// V57 is the protagonist consistency pass based on the 2026-09-03 iPhone
// recording. The recording exposed three separate presentation problems that a
// single per-state scale table could not solve:
//   1) idle was being over-scaled by V54 (1.16x) and visibly popped larger;
//   2) run east/west were separately authored and V54 made them another 4%
//      apart at runtime (east 1.02, west .98);
//   3) the east run source has extreme frame-bottom-padding jumps, producing a
//      rhythmic vertical snap even though the physics body itself is smooth.
//
// Production rule from this pass onward:
//   - one canonical anatomical scale for all normal living actions;
//   - no direction-dependent scale multipliers;
//   - idle and run use one canonical side-view source mirrored for the opposite
//     direction, guaranteeing exact left/right proportions;
//   - the run cycle uses a deliberately smoothed body/foot contact anchor rather
//     than grounding every frame on its lowest opaque sword/cape/boot pixel.
//
// Hit remains reduced because that source animation is genuinely drawn larger.
// Death keeps the approved V53 body-contact scale/grounding unchanged.

const VERSION='v57-protagonist-consistency-20260903-1';
export const V57_CACHE_BUST=VERSION;
const PLAYER_FEET_Y=24;
const V17_ART_SCALE=.396;

export const PROTAGONIST_STATE_SCALE_V57=Object.freeze({
  idle:1,
  run:1,
  jump:1,
  fall:1,
  land:1,
  dash:1,
  attack_1:1,
  attack_2:1,
  attack_3:1,
  hit:.83,
  death:.92,
});

// The west run source is visibly steadier than the separately-authored east
// sequence. Use it as the canonical side-view run and mirror it for east.
// Idle receives the same treatment because the recording showed a substantial
// east/west idle proportion difference once V54's 1.16 scale was applied.
function mirrorEastFromWest(action){
  const meta=PIXELLAB_MANIFEST[action];
  if(!meta?.west)return;
  meta.mirrorEast=true;
  meta.mirrorSourceDirection='west';
}
mirrorEastFromWest('idle');
mirrorEastFromWest('run');

// Raw west run padding is [57,50,51,52,52,48,45,45,46]. The first frame and
// late-cycle drop are source-layout artifacts, not useful body motion. A circular
// five-frame smoothing pass yields this contact curve. Adjacent frames now move
// by at most 2 source px (~1 rendered world px) and the loop seam moves by 1 px.
// This preserves a small natural run bob while removing the visible snap.
export const RUN_CONTACT_PADDING_V57=Object.freeze([50,51,52,51,50,48,47,48,49]);

// Exact V53 death-body calibration. Do not fold death into the generic grounded
// contact rule: the prone body must rest on the floor even though the sword/cape
// extends below the torso in the source PNGs.
const DEATH_BODY_CONTACT_SOURCE_PX=Object.freeze([0,4,12,24,34,42,48,52]);

function actionFor(scene){
  const time=scene?.time?.now||0;
  let action='';
  try{action=scene?.resolvePixelState?.(time)||'';}catch(_){action='';}
  if(!action||action==='turning')action=scene?.visualAnimationState||'idle';
  return PROTAGONIST_STATE_SCALE_V57[action]!==undefined?action:'idle';
}

function directionFor(scene){
  const logical=String(scene?.pixelDirection||'');
  if(logical==='east'||logical==='west')return logical;
  return scene?.facing<0?'west':'east';
}

function currentFrameFor(scene,action){
  if(!action)return-1;
  const key=String(scene?.currentPixelKey||'');
  const match=key.match(new RegExp(`^px-${action}-(?:east|west)-(\\d{3})$`));
  return match?Number(match[1]):-1;
}

function normalizedBottomPadding(scene,action,rawPadding){
  if(action!=='run')return rawPadding;
  const frame=currentFrameFor(scene,action);
  if(frame<0)return rawPadding;
  return RUN_CONTACT_PADDING_V57[Math.min(frame,RUN_CONTACT_PADDING_V57.length-1)]??rawPadding;
}

function deathBodySink(scene,action,targetScale){
  if(action!=='death')return 0;
  const frame=currentFrameFor(scene,action);
  if(frame<0)return 0;
  const sourcePx=DEATH_BODY_CONTACT_SOURCE_PX[Math.min(frame,DEATH_BODY_CONTACT_SOURCE_PX.length-1)]||0;
  return sourcePx*targetScale;
}

// V17 selects the frame first and temporarily places it using its .396 source
// scale. Recover that raw source padding, replace the run anchor with V57's
// stabilized contact curve, then apply one canonical anatomical scale.
GameSceneV18.prototype.applyV18ArtScale=function(){
  if(!this.pixelArt||!this.player)return;

  const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
  const rawBottomPadding=Math.abs(V17_ART_SCALE)>1e-6?oldOffset/V17_ART_SCALE:0;
  const action=actionFor(this);
  const direction=directionFor(this);
  const frame=currentFrameFor(this,action);
  const factor=PROTAGONIST_STATE_SCALE_V57[action]??1;
  const targetScale=PROTAGONIST_ART_SCALE_V18*factor;
  const bottomPadding=normalizedBottomPadding(this,action,rawBottomPadding);
  const deathSink=deathBodySink(this,action,targetScale);

  this.pixelArt
    .setPosition(
      this.player.x,
      this.player.y+PLAYER_FEET_Y+bottomPadding*targetScale+deathSink,
    )
    .setScale(targetScale);

  this.v57VisualAction=action;
  this.v57VisualDirection=direction;
  this.v57VisualFactor=factor;
  this.v57VisualFrame=frame;
  this.v57BottomPadding=bottomPadding;
  this.v57DeathSink=deathSink;
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const action=scene?.v57VisualAction||actionFor(scene);
  const direction=scene?.v57VisualDirection||directionFor(scene);
  const factor=scene?.v57VisualFactor??(PROTAGONIST_STATE_SCALE_V57[action]??1);
  const frame=Number.isFinite(scene?.v57VisualFrame)&&scene.v57VisualFrame>=0?` F${scene.v57VisualFrame}`:'';
  const pad=action==='run'&&Number.isFinite(scene?.v57BottomPadding)?` P${scene.v57BottomPadding.toFixed(0)}`:'';
  const grounded=scene?.player?.body?.blocked?.down?'G1':'G0';
  const sink=scene?.v57DeathSink?` Y+${scene.v57DeathSink.toFixed(1)}`:'';
  const text=`V57 • CONSISTENT ${action}/${direction} x${factor.toFixed(2)}${frame}${pad}${sink} ${grounded}`;
  if(marker.textContent!==text)marker.textContent=text;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  setMarker(this);
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  if(this.environmentLayout?.grammar===CATHEDRAL_V38.grammar)setMarker(this);
};
