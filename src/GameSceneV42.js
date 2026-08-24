import { GameSceneV38 } from './GameSceneV38.js';

// V42 removes the stacked V39/V40/V41 rescue patches. Those patches duplicated
// the full protagonist texture set and made it harder to distinguish a missing
// web asset from a display-object problem. V42 uses the normal production keys
// only, owns one visible renderer anchored directly to the physics player, and
// falls back to a committed SVG only when the production frame truly is absent.
const FALLBACK_KEY='v42-protagonist-body';
const FALLBACK_URL='./assets/protagonist-body.svg?v=v42-protagonist-production-reset-20260824-1';
const FALLBACK_IDLE='px-idle-east-000';
const PLAYER_FEET_Y=24;
const PRODUCTION_SCALE=.50094;
const FALLBACK_WIDTH=116;
const FALLBACK_HEIGHT=154;
export const PROTAGONIST_DEPTH_V42=760;
export const V42_CACHE_BUST='v42-protagonist-production-reset-20260824-1';

function queueFallbackV42(){
  if(!this.textures?.exists?.(FALLBACK_KEY))this.load.svg(FALLBACK_KEY,FALLBACK_URL);
}

function productionKeyV42(){
  const current=typeof this.currentPixelKey==='string'&&this.currentPixelKey
    ?this.currentPixelKey
    :FALLBACK_IDLE;
  if(this.textures?.exists?.(current))return current;
  if(this.textures?.exists?.(FALLBACK_IDLE))return FALLBACK_IDLE;
  return null;
}

function preferredKeyV42(){
  return productionKeyV42.call(this)||(this.textures?.exists?.(FALLBACK_KEY)?FALLBACK_KEY:null);
}

function ensureProtagonistV42(){
  if(!this.player)return null;
  const key=preferredKeyV42.call(this);
  if(!key)return null;

  if(!this.v42ProtagonistArt||this.v42ProtagonistArt.active===false||!this.v42ProtagonistArt.scene){
    this.v42ProtagonistArt=this.add.image(this.player.x,this.player.y+PLAYER_FEET_Y,key)
      .setOrigin(.5,1)
      .setDepth(PROTAGONIST_DEPTH_V42)
      .setScrollFactor(1,1)
      .setVisible(true)
      .setActive(true)
      .setAlpha(1);
  }

  const art=this.v42ProtagonistArt;
  if(art.texture?.key!==key)art.setTexture(key);

  art
    .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y)
    .setOrigin(.5,1)
    .setDepth(PROTAGONIST_DEPTH_V42)
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
    art.setFlipX(!!this.pixelArt?.flipX);
  }

  // V42 is the only visible protagonist display object. The inherited pixelArt
  // object still drives animation state/currentPixelKey but is not rendered.
  this.pixelArt?.setVisible?.(false);
  this.player.setVisible?.(true).setActive?.(true).setAlpha?.(1);

  if(typeof document!=='undefined'){
    document.documentElement.dataset.protagonistArt=key===FALLBACK_KEY?'fallback':'production';
    document.documentElement.dataset.protagonistTexture=key;
  }
  return art;
}

const originalPreload=GameSceneV38.prototype.preload;
GameSceneV38.prototype.preload=function(){
  originalPreload.call(this);
  queueFallbackV42.call(this);
};

const originalCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  originalCreate.call(this);
  this.ensureProtagonistV42();
};

const originalRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  originalRebuild.call(this,template);
  this.ensureProtagonistV42();
};

const originalUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  originalUpdate.call(this,time,delta);
  this.ensureProtagonistV42();
};

GameSceneV38.prototype.ensureProtagonistV42=ensureProtagonistV42;
