import { GameSceneV38 } from './GameSceneV38.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const ROOT='./assets/v05/pixellab_protagonist';
const CACHE_BUST='protagonist-v39-rescue-20260823-2';
const RESCUE_PREFIX='v39-';
const PROTAGONIST_DEPTH_V39=300;

function frameKey(action,direction,index){
  return `px-${action}-${direction}-${String(index).padStart(3,'0')}`;
}
function rescueFrameKey(action,direction,index){return `${RESCUE_PREFIX}${frameKey(action,direction,index)}`;}
function rotationKey(source,direction){return `px-rotation-${source}-${direction}`;}
function rescueRotationKey(source,direction){return `${RESCUE_PREFIX}${rotationKey(source,direction)}`;}

function queueFreshProtagonistTexturesV39(){
  const loadedRotations=new Set();
  for(const [action,meta] of Object.entries(PIXELLAB_MANIFEST)){
    if(!meta||typeof meta!=='object')continue;
    for(const direction of ['east','west']){
      const count=Math.max(0,Number(meta?.[direction])||0);
      for(let index=0;index<count;index++){
        const file=`frame_${String(index).padStart(3,'0')}.png`;
        this.load.image(
          rescueFrameKey(action,direction,index),
          `${ROOT}/${action}/${direction}/${file}?v=${CACHE_BUST}`,
        );
      }
    }
    const source=meta.rotationSource||action;
    for(const direction of meta.rotations||[]){
      const identity=`${source}:${direction}`;
      if(loadedRotations.has(identity))continue;
      loadedRotations.add(identity);
      this.load.image(
        rescueRotationKey(source,direction),
        `${ROOT}/${source}/rotations/${direction}.png?v=${CACHE_BUST}`,
      );
    }
  }
}

function repairFreshProtagonistTextureV39(){
  if(!this.player||!this.pixelArt)return;
  const canonical=this.currentPixelKey||'';
  const rescue=canonical?`${RESCUE_PREFIX}${canonical}`:'';
  if(rescue&&this.textures?.exists?.(rescue)&&this.pixelArt.texture?.key!==rescue){
    this.pixelArt.setTexture(rescue);
  }
  this.player.setVisible?.(true).setActive?.(true);
  this.pixelArt
    .setVisible(true)
    .setActive(true)
    .setDepth(PROTAGONIST_DEPTH_V39)
    .setScrollFactor(1,1);
  if(!this.dead&&this.pixelArt.alpha<=.01)this.pixelArt.setAlpha(1);
}

// Keep V38 as the live scene so every existing traversal/combat regression and
// the visibility guard from PR #31 remain intact. V39 is a surgical texture
// rescue patch layered on top of those already-tested V38 methods.
const originalPreload=GameSceneV38.prototype.preload;
GameSceneV38.prototype.preload=function(){
  originalPreload.call(this);
  queueFreshProtagonistTexturesV39.call(this);
};

const originalCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  originalCreate.call(this);
  this.updatePixelArt?.(this.time?.now||0);
  repairFreshProtagonistTextureV39.call(this);
};

const originalUpdatePixelArt=GameSceneV38.prototype.updatePixelArt;
GameSceneV38.prototype.updatePixelArt=function(time){
  originalUpdatePixelArt.call(this,time);
  repairFreshProtagonistTextureV39.call(this);
};

const originalUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  originalUpdate.call(this,time,delta);
  repairFreshProtagonistTextureV39.call(this);
};

export { CACHE_BUST, RESCUE_PREFIX, PROTAGONIST_DEPTH_V39 };
