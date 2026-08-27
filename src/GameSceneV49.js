import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';
import { GameSceneV18, PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

// V49 is a presentation/grounding calibration pass after the V48 world-bounds
// repair. Two separate issues were visible once the real cathedral was back:
//
// 1) V38 authored several floor/platform Y positions on half-tile coordinates
//    (for example 2448 = 76.5 * 32). renderGothicTerrain() rounds geometry to
//    the nearest 32 px tile, while the invisible physics collider previously
//    stayed at the unsnapped authored coordinate. That creates a visible 16 px
//    gap or sink on some surfaces, while already-grid-aligned platforms look
//    correct. During cathedral construction, snap collider X/Y to the same tile
//    grid used by the renderer so visible stone and physics are one surface.
//
// 2) The production idle export is visually smaller than the run/jump/attack
//    family, while the hit export is slightly larger. V18 already converts the
//    V17 frame-aware foot padding to the final production scale. Reuse that
//    exact padding conversion, but apply a very small per-action calibration so
//    state changes no longer make the protagonist appear to grow or shrink.

const VERSION='v49-grounding-scale-calibration-20260827-1';
export const V49_CACHE_BUST=VERSION;

const TILE=32;
const PLAYER_FEET_Y=24;

// Calibrated against the run/jump/attack family, which remains the 1.0 visual
// reference. Idle needs a modest lift; hit needs a modest reduction.
export const PROTAGONIST_STATE_SCALE_V49=Object.freeze({
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
  death:1,
});

function snapTile(value){
  const numeric=Number(value);
  return Number.isFinite(numeric)?Math.round(numeric/TILE)*TILE:value;
}

function snappedSurfaceSpec(spec){
  if(!spec||typeof spec!=='object')return spec;
  return{
    ...spec,
    x:snapTile(spec.x),
    y:snapTile(spec.y),
  };
}

function isCathedralBuild(scene,template){
  return (scene?.runGraphDepth||0)===0&&template?.id!=='boss1';
}

function scaleFactorFor(scene){
  const time=scene?.time?.now||0;
  let action='';
  try{action=scene?.resolvePixelState?.(time)||'';}catch(_){action='';}
  if(!action||action==='turning')action=scene?.visualAnimationState||'idle';
  return PROTAGONIST_STATE_SCALE_V49[action]||1;
}

// Patch the V18 production-scale conversion at its source. V17 has just placed
// the art using its frame-specific transparent-bottom padding and source scale.
// Recover that padding from the current offset, then reapply it using the V49
// target scale. This keeps the visible boots on exactly the same foot line while
// changing only perceived character size.
GameSceneV18.prototype.applyV18ArtScale=function(){
  if(!this.pixelArt||!this.player)return;
  const sourceScale=Math.abs(Number(this.pixelArt.scaleY))||1;
  const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
  const bottomPadding=sourceScale>1e-6?oldOffset/sourceScale:0;
  const targetScale=PROTAGONIST_ART_SCALE_V18*scaleFactorFor(this);
  this.pixelArt
    .setPosition(
      this.player.x,
      this.player.y+PLAYER_FEET_Y+bottomPadding*targetScale,
    )
    .setScale(targetScale);
};

// Only snap colliders while V38 is constructing the cathedral. This avoids
// changing boss rooms, legacy rooms, gates, or later dynamic physics objects.
const previousEnvironmentCollider=GameSceneV38.prototype.addEnvironmentCollider;
GameSceneV38.prototype.addEnvironmentCollider=function(spec){
  return previousEnvironmentCollider.call(
    this,
    this.v49BuildingCathedral?snappedSurfaceSpec(spec):spec,
  );
};

const previousTraversalCollider=GameSceneV38.prototype.addTraversalCollider;
GameSceneV38.prototype.addTraversalCollider=function(spec){
  return previousTraversalCollider.call(
    this,
    this.v49BuildingCathedral?snappedSurfaceSpec(spec):spec,
  );
};

const previousRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  const snap=isCathedralBuild(this,template);
  this.v49BuildingCathedral=snap;
  try{
    return previousRebuild.call(this,template);
  }finally{
    this.v49BuildingCathedral=false;
  }
};

function setMarker(scene){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const player=scene?.player;
  const grounded=player?.body?.blocked?.down?'G1':'G0';
  marker.textContent=`V49 • ALIGN ${grounded} P${Math.round(player?.x||0)},${Math.round(player?.y||0)} H${Math.round(scene?.worldHeight||0)}`;
}

// V48 owns the world-bounds repair and still runs first. V49 only labels the
// live build after V48 completes so screenshots identify the calibration pass.
const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  setMarker(this);
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  if(this.environmentLayout?.grammar===CATHEDRAL_V38.grammar){
    if((this.v49MarkerTick=(this.v49MarkerTick||0)+1)%30===0)setMarker(this);
  }
};
