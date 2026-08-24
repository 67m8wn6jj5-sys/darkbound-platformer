import { GameSceneV38 } from './GameSceneV38.js';
import './v38ProtagonistVisibilityFix.js';
import { RESCUE_PREFIX } from './GameSceneV39.js';

const FALLBACK_CANONICAL='px-idle-east-000';
const PLAYER_FEET_Y=24;
export const PROTAGONIST_DEPTH_V40=600;
export const V40_ENTRY_CACHE_BUST='v40-protagonist-rescue-20260824-1';

function finite(value,fallback){return Number.isFinite(value)?value:fallback;}

function preferredTextureV40(){
  const canonical=this.currentPixelKey||FALLBACK_CANONICAL;
  const rescue=`${RESCUE_PREFIX}${canonical}`;
  if(this.textures?.exists?.(rescue))return rescue;
  if(this.textures?.exists?.(canonical))return canonical;
  const rescueFallback=`${RESCUE_PREFIX}${FALLBACK_CANONICAL}`;
  if(this.textures?.exists?.(rescueFallback))return rescueFallback;
  return this.textures?.exists?.(FALLBACK_CANONICAL)?FALLBACK_CANONICAL:null;
}

function createDedicatedProtagonistV40(){
  if(this.v40ProtagonistArt?.active!==false)return this.v40ProtagonistArt;
  const key=preferredTextureV40.call(this);
  if(!key||!this.player)return null;
  this.v40ProtagonistArt=this.add.image(
    this.player.x,
    this.player.y+PLAYER_FEET_Y,
    key,
  )
    .setOrigin(.5,1)
    .setDepth(PROTAGONIST_DEPTH_V40)
    .setScrollFactor(1,1)
    .setVisible(true)
    .setAlpha(1);
  return this.v40ProtagonistArt;
}

function syncDedicatedProtagonistV40(){
  if(!this.player)return;
  const art=createDedicatedProtagonistV40.call(this);
  if(!art)return;

  const source=this.pixelArt;
  const key=preferredTextureV40.call(this);
  if(key&&art.texture?.key!==key)art.setTexture(key);

  const x=finite(source?.x,this.player.x);
  const y=finite(source?.y,this.player.y+PLAYER_FEET_Y);
  const originX=finite(source?.originX,.5);
  const originY=finite(source?.originY,1);
  const scaleX=Math.abs(finite(source?.scaleX,.50094));
  const scaleY=Math.abs(finite(source?.scaleY,.50094));

  art
    .setPosition(x,y)
    .setOrigin(originX,originY)
    .setScale(scaleX,scaleY)
    .setFlipX(!!source?.flipX)
    .setFlipY(!!source?.flipY)
    .setScrollFactor(1,1)
    .setDepth(PROTAGONIST_DEPTH_V40)
    .setActive(true)
    .setVisible(true)
    .setAlpha(1);

  // Keep the legacy image alive as the animation-state driver, but V40 owns a
  // second, independent visible image. If Safari drops/detaches the legacy
  // display object, the player still has a renderable sprite on screen.
  this.player.setVisible?.(true).setActive?.(true);
}

GameSceneV38.prototype.createDedicatedProtagonistV40=createDedicatedProtagonistV40;
GameSceneV38.prototype.syncDedicatedProtagonistV40=syncDedicatedProtagonistV40;

const originalCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  originalCreate.call(this);
  this.syncDedicatedProtagonistV40();
};

const originalRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  originalRebuild.call(this,template);
  this.syncDedicatedProtagonistV40();
};

const originalUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  originalUpdate.call(this,time,delta);
  this.syncDedicatedProtagonistV40();
};
