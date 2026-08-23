import { GameSceneV38 } from './GameSceneV38.js';
import { PROTAGONIST_ART_SCALE_V18 } from './GameSceneV18.js';

const PLAYER_FEET_Y=24;
const FALLBACK_IDLE_KEY='px-idle-east-000';
const PROTAGONIST_DEPTH_V38=140;

function validDisplayObject(object){
  return !!object&&object.active!==false&&object.scene;
}

function ensureProtagonistRenderV38(time=this.time?.now||0){
  if(!this.player||this.dead)return;

  // A Cathedral rebuild relocates the physics actor by more than two thousand
  // pixels. Never assume the legacy V17/V18 art object survived that room
  // reconstruction or will repair itself later on the next animation tick.
  if(!validDisplayObject(this.pixelArt)){
    if(!this.textures?.exists?.(FALLBACK_IDLE_KEY))return;
    this.pixelArt=this.add.image(
      this.player.x,
      this.player.y+PLAYER_FEET_Y,
      FALLBACK_IDLE_KEY,
    )
      .setOrigin(.5,1)
      .setScale(PROTAGONIST_ART_SCALE_V18)
      .setDepth(PROTAGONIST_DEPTH_V38)
      .setScrollFactor(1,1);
    this.currentPixelKey='';
    this.pixelDirection=this.facing<0?'west':'east';
  }

  this.player.setVisible?.(true).setActive?.(true);
  this.pixelArt
    .setVisible(true)
    .setActive(true)
    .setAlpha(1)
    .setDepth(PROTAGONIST_DEPTH_V38)
    .setScrollFactor(1,1);

  // Reuse the established frame-padding/grounding code rather than duplicating
  // protagonist placement math here. Calling it after a room rebuild also fixes
  // the temporary raw layout.player position applied by placeEnvironmentActors.
  this.updatePixelArt?.(time);

  this.pixelArt
    .setVisible(true)
    .setAlpha(1)
    .setDepth(PROTAGONIST_DEPTH_V38)
    .setScrollFactor(1,1);
}

GameSceneV38.prototype.ensureProtagonistRenderV38=ensureProtagonistRenderV38;

const originalCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  originalCreate.call(this);
  this.ensureProtagonistRenderV38(this.time?.now||0);
};

const originalRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  originalRebuild.call(this,template);
  if(this.isCathedralV38?.())this.ensureProtagonistRenderV38(this.time?.now||0);
};

const originalUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  originalUpdate.call(this,time,delta);
  this.ensureProtagonistRenderV38(time);
};
