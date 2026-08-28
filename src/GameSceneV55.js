import { GameSceneV34 } from './GameSceneV34.js';
import { GameSceneV36 } from './GameSceneV36.js';
import { GameSceneV38 } from './GameSceneV38.js';

// V55 removes the two legacy full-screen effects that were reading as visual
// corruption on iPhone Safari. They were prototype-era presentation layers,
// not gameplay assets:
//   1) V34's fixed-to-screen tiled wall/architecture wash;
//   2) V36's three fixed-to-screen fog ellipse bands.
//
// Production rule going forward: atmosphere must be spatially motivated,
// localized, camera-aware, and subordinate to gameplay readability. We keep the
// authored world geometry, skyline, localized lamps/halos, terrain shadows,
// props, and exit-gate lighting. No replacement full-screen wash is introduced.

const VERSION='v55-clean-production-presentation-20260828-1';
export const V55_CACHE_BUST=VERSION;

// Suppress the screen-locked texture wash at its source. Returning an empty
// object preserves the V34/V36 parallax contract: resize/update already guard
// missing wall/architecture members.
GameSceneV34.prototype.addParallaxTexturesV34=function(){
  return {};
};

// Suppress the oversized translucent ellipse bands. Returning an empty array
// preserves V36's v34Parallax.atmosphere shape without creating render objects.
GameSceneV36.prototype.addAtmosphereV36=function(){
  return [];
};

function destroyNode(node){
  if(!node)return;
  try{node.destroy?.();}catch(_){/* cleanup must never interrupt gameplay */}
}

// Defensive cleanup for a hot reload / stale scene that may already contain a
// legacy overlay. This intentionally leaves far/mid skyline layers and all
// localized lighting untouched.
function removeLegacyScreenOverlays(scene){
  const p=scene?.v34Parallax;
  if(!p)return;

  if(p.wall){destroyNode(p.wall);p.wall=null;}
  if(p.architecture){destroyNode(p.architecture);p.architecture=null;}
  if(Array.isArray(p.atmosphere)){
    p.atmosphere.forEach(destroyNode);
    p.atmosphere=[];
  }
}

function setMarker(){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(marker)marker.textContent='V55 • CLEAN';
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  removeLegacyScreenOverlays(this);
  setMarker();
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  // Room rebuilds can happen during the run. The source methods are disabled,
  // but this also cleans stale objects if Safari restores an older scene state.
  if((this.v55CleanTick=(this.v55CleanTick||0)+1)%30===0){
    removeLegacyScreenOverlays(this);
    setMarker();
  }
};
