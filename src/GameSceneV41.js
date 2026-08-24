import { GameSceneV38 } from './GameSceneV38.js';
import { RESCUE_PREFIX } from './GameSceneV39.js';

// V41 deliberately does not trust pixelArt's transform. The physics actor is
// known to be alive (the camera follows it and input moves it), so this renderer
// is anchored directly to the player every frame. If the generated PixelLab
// texture is unavailable for any reason, a committed SVG body is used instead
// so the player can never be completely invisible.
const FALLBACK_KEY='v41-protagonist-body';
const FALLBACK_URL='./assets/protagonist-body.svg?v=v41-protagonist-hard-fallback-20260824-1';
const FALLBACK_IDLE='px-idle-east-000';
const PLAYER_FEET_Y=24;
const PRODUCTION_SCALE=.50094;
const FALLBACK_WIDTH=78;
const FALLBACK_HEIGHT=104;
export const PROTAGONIST_DEPTH_V41=760;
export const V41_CACHE_BUST='v41-protagonist-hard-fallback-20260824-1';

function queueGuaranteedFallbackV41(){
  if(this.textures?.exists?.(FALLBACK_KEY))return;
  this.load.svg(FALLBACK_KEY,FALLBACK_URL);
}

function productionKeyV41(){
  const current=typeof this.currentPixelKey==='string'&&this.currentPixelKey
    ?this.currentPixelKey
    :FALLBACK_IDLE;
  const rescue=`${RESCUE_PREFIX}${current}`;
  if(this.textures?.exists?.(rescue))return rescue;
  if(this.textures?.exists?.(current))return current;

  const rescueIdle=`${RESCUE_PREFIX}${FALLBACK_IDLE}`;
  if(this.textures?.exists?.(rescueIdle))return rescueIdle;
  if(this.textures?.exists?.(FALLBACK_IDLE))return FALLBACK_IDLE;
  return null;
}

function preferredKeyV41(){
  return productionKeyV41.call(this)||(this.textures?.exists?.(FALLBACK_KEY)?FALLBACK_KEY:null);
}

function ensureHardProtagonistV41(){
  if(!this.player)return null;
  const key=preferredKeyV41.call(this);
  if(!key)return null;

  if(!this.v41ProtagonistArt||this.v41ProtagonistArt.active===false||!this.v41ProtagonistArt.scene){
    this.v41ProtagonistArt=this.add.image(this.player.x,this.player.y+PLAYER_FEET_Y,key)
      .setOrigin(.5,1)
      .setDepth(PROTAGONIST_DEPTH_V41)
      .setScrollFactor(1,1)
      .setVisible(true)
      .setActive(true)
      .setAlpha(1);
  }

  const art=this.v41ProtagonistArt;
  if(art.texture?.key!==key)art.setTexture(key);

  // Never inherit x/y/scale from pixelArt here. That was the remaining failure
  // path in V40: a perfectly visible rescue image could still copy a stale,
  // off-camera or zero-scale legacy transform.
  art
    .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y)
    .setOrigin(.5,1)
    .setDepth(PROTAGONIST_DEPTH_V41)
    .setScrollFactor(1,1)
    .setVisible(true)
    .setActive(true)
    .setAlpha(1)
    .setFlipY(false);

  art.clearTint?.();
  art.clearMask?.();
  art.cameraFilter=0;

  if(key===FALLBACK_KEY){
    art.setDisplaySize(FALLBACK_WIDTH,FALLBACK_HEIGHT);
    art.setFlipX((this.facing||1)<0);
  }else{
    art.setScale(PRODUCTION_SCALE);
    // Preserve only the legacy mirror flag; position and scale remain V41-owned.
    art.setFlipX(!!this.pixelArt?.flipX);
  }

  // The physics container itself must remain live because camera/input/weapon
  // logic are attached to it, but V41 rendering is otherwise independent.
  this.player.setVisible?.(true).setActive?.(true).setAlpha?.(1);
  return art;
}

const originalPreload=GameSceneV38.prototype.preload;
GameSceneV38.prototype.preload=function(){
  originalPreload.call(this);
  queueGuaranteedFallbackV41.call(this);
};

const originalCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  originalCreate.call(this);
  this.ensureHardProtagonistV41();
};

const originalRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  originalRebuild.call(this,template);
  this.ensureHardProtagonistV41();
};

const originalUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  originalUpdate.call(this,time,delta);
  this.ensureHardProtagonistV41();
};

GameSceneV38.prototype.ensureHardProtagonistV41=ensureHardProtagonistV41;
