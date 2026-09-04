import { GameSceneV38 } from './GameSceneV38.js';
import { TUNING } from './config.js';

// V60 is a traversal-tuning pass. The cathedral's first intended ascent is
// 128 px above the entry floor, while the previous -590 jump only produced
// roughly 120 px of full-hold ballistic rise at 1450 px/s^2. That made the
// authored route mathematically unreachable even with perfect input.
//
// The movement change itself lives in config.js so the base movement system,
// coyote time, jump buffering, and variable-height release behavior all keep
// working unchanged. This patch only exposes the live V60 build marker after
// the retained V59 combat marker has updated.

const VERSION='v60-cathedral-jump-reach-20260904-1';
export const V60_CACHE_BUST=VERSION;
export const V60_FULL_HOLD_APEX_PX=(TUNING.jumpVelocity*TUNING.jumpVelocity)/(2*TUNING.gravityY);

function relabelBuildMarker(){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const current=String(marker.textContent||'');
  if(/^V59 •/.test(current)){
    marker.textContent=current.replace(/^V59/,'V60');
    return;
  }
  if(!/^V60 •/.test(current)){
    marker.textContent=`V60 • JUMP ${Math.round(V60_FULL_HOLD_APEX_PX)}px`;
  }
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  relabelBuildMarker();
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  relabelBuildMarker();
};
