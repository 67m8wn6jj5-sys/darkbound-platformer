import { GameSceneV34 } from './GameSceneV34.js';
import { GameSceneV35 } from './GameSceneV35.js';
import { GameSceneV36 } from './GameSceneV36.js';
import { GameSceneV38 } from './GameSceneV38.js';

// V56 fixes the remaining horizontal translucent bands. V55 disabled the V34
// texture factory, but V35 overrides that same method and was still creating
// three viewport-sized, screen-locked tile layers (wall / architecture / near).
// Those layers began at hard Y boundaries, which is why they read as long
// transparent rectangles across the entire phone screen.
//
// Production rule: no full-viewport translucent texture slabs. Keep only
// world-space architectural depth, localized lighting, and authored geometry.

const VERSION='v56-remove-screen-space-bands-20260828-1';
export const V56_CACHE_BUST=VERSION;

// Backstop for any older route that resolves to V34 directly.
GameSceneV34.prototype.addParallaxTexturesV34=function(){
  return {};
};

// This is the important fix: V35 owns the live override inherited by V38.
// Preserve its world-space depth bays, but do not create the fixed-to-screen
// wall/architecture/near tileSprites.
GameSceneV35.prototype.addParallaxTexturesV34=function(layout){
  const bays=this.addDepthBaysV35?.(layout)||[];
  return {bays};
};

// Keep V36 atmosphere disabled as in V55.
GameSceneV36.prototype.addAtmosphereV36=function(){
  return [];
};

function destroyNode(node){
  if(!node)return;
  try{node.destroy?.();}catch(_){/* visual cleanup must not interrupt play */}
}

function removeScreenSpaceBands(scene){
  const p=scene?.v34Parallax;
  if(!p)return;

  for(const key of ['wall','architecture','near']){
    if(p[key]){
      destroyNode(p[key]);
      p[key]=null;
    }
  }

  if(Array.isArray(p.atmosphere)){
    p.atmosphere.forEach(destroyNode);
    p.atmosphere=[];
  }
}

function setMarker(){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(marker)marker.textContent='V56 • CLEAR';
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  removeScreenSpaceBands(this);
  setMarker();
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  if((this.v56CleanTick=(this.v56CleanTick||0)+1)%30===0){
    removeScreenSpaceBands(this);
    setMarker();
  }
};
