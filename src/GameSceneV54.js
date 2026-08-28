import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';
import { GameSceneV18, PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

// V54 normalizes the protagonist's perceived anatomical size from measurements
// taken directly from the production PNG frames. Unlike V50, this does NOT use
// total opaque silhouette area at runtime (sword/cape/hair motion makes that
// pose-sensitive). The calibration is a stable, hand-reviewed table derived
// from compact body/hair/core measurements with run as the canonical reference.
//
// The two clear source-art mismatches are:
//   - idle: head/hair/body details are drawn smaller than the moving set;
//   - hit: the whole character is drawn substantially larger (median source
//     height ~181 px versus ~150 px for run), so .83 brings it back to the same
//     anatomical height instead of the previous .90 approximation.
//
// Run has separately-authored east/west frames. Their measured body cores differ
// by ~7.9% in area, so a very small reciprocal direction correction removes the
// left/right size pop without changing the average run size. Other states stay
// at or very near the canonical scale unless measurements show a repeatable
// source-size bias. V53's approved death body-contact grounding is preserved.

const VERSION='v54-protagonist-size-normalization-20260827-1';
export const V54_CACHE_BUST=VERSION;
const PLAYER_FEET_Y=24;
const V17_ART_SCALE=.396;

const BASE_STATE_SCALE=Object.freeze({
  idle:1.16,
  run:1,
  jump:1,
  fall:1,
  land:1,
  dash:1.02,
  attack_1:1,
  attack_2:.99,
  attack_3:.98,
  hit:.83,
  death:.92,
});

// Separate run artwork is not perfectly matched: east's measured core is a bit
// smaller and west's is a bit larger. These reciprocal corrections keep the
// canonical run average unchanged while making both directions read the same.
const DIRECTION_SCALE=Object.freeze({
  run:Object.freeze({east:1.02,west:.98}),
});

// Exact V53 body-contact calibration. Keep this stable: the user-approved V53
// death pose finally rests on the floor rather than grounding on the sword tip.
const DEATH_BODY_CONTACT_SOURCE_PX=Object.freeze([0,4,12,24,34,42,48,52]);

function actionFor(scene){
  const time=scene?.time?.now||0;
  let action='';
  try{action=scene?.resolvePixelState?.(time)||'';}catch(_){action='';}
  if(!action||action==='turning')action=scene?.visualAnimationState||'idle';
  return BASE_STATE_SCALE[action]!==undefined?action:'idle';
}

function directionFor(scene){
  const logical=String(scene?.pixelDirection||'');
  if(logical==='east'||logical==='west')return logical;
  return scene?.facing<0?'west':'east';
}

function factorFor(action,direction){
  const base=BASE_STATE_SCALE[action]??1;
  const directionFactor=DIRECTION_SCALE[action]?.[direction]??1;
  return base*directionFactor;
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

// V17 always positions each selected PNG using frame-specific transparent-bottom
// padding at .396. Recover that source-space padding and reapply it at the final
// normalized scale so scale corrections never pull grounded boots off the floor.
GameSceneV18.prototype.applyV18ArtScale=function(){
  if(!this.pixelArt||!this.player)return;

  const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
  const bottomPadding=Math.abs(V17_ART_SCALE)>1e-6?oldOffset/V17_ART_SCALE:0;
  const action=actionFor(this);
  const direction=directionFor(this);
  const factor=factorFor(action,direction);
  const targetScale=PROTAGONIST_ART_SCALE_V18*factor;
  const deathSink=deathBodySink(this,action,targetScale);

  this.pixelArt
    .setPosition(
      this.player.x,
      this.player.y+PLAYER_FEET_Y+bottomPadding*targetScale+deathSink,
    )
    .setScale(targetScale);

  this.v54VisualAction=action;
  this.v54VisualDirection=direction;
  this.v54VisualFactor=factor;
  this.v54VisualFrame=currentFrameFor(this,action);
  this.v54DeathSink=deathSink;
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const action=scene?.v54VisualAction||actionFor(scene);
  const direction=scene?.v54VisualDirection||directionFor(scene);
  const factor=scene?.v54VisualFactor??factorFor(action,direction);
  const frame=Number.isFinite(scene?.v54VisualFrame)&&scene.v54VisualFrame>=0?` F${scene.v54VisualFrame}`:'';
  const grounded=scene?.player?.body?.blocked?.down?'G1':'G0';
  const sink=scene?.v54DeathSink?` Y+${scene.v54DeathSink.toFixed(1)}`:'';
  marker.textContent=`V54 • NORM ${action}/${direction} x${factor.toFixed(2)}${frame}${sink} ${grounded}`;
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
    if((this.v54MarkerTick=(this.v54MarkerTick||0)+1)%8===0)setMarker(this);
  }
};
