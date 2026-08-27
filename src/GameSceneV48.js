import { GameSceneV38, CATHEDRAL_V38 } from './GameSceneV38.js';

// V48 fixes the actual root cause of the mobile protagonist/floor failure.
// GameSceneV33.create/loadRunNode re-applies its old 720px-tall traversal
// bounds after V38 has already built the 2720px cathedral. With collideWorldBounds
// enabled, that clamps the player to about y=996 (720+300 minus the body foot),
// while the cathedral entry floor is down at y=2448. The camera is also limited
// to the old short world, so the native protagonist and the real floor end up
// outside the visible playfield.
//
// Do not render a second protagonist. Restore the V38 cathedral bounds after
// the inherited V33 lifecycle has finished, reset the real physics player to
// the authored V38 entry spawn, and let the existing Phaser protagonist art,
// combat, enemies, jumping, collision and camera all use the same world again.

const VERSION='v48-cathedral-bounds-root-fix-20260827-1';
export const V48_CACHE_BUST=VERSION;

function isCathedral(scene){
  return scene?.environmentLayout?.grammar===CATHEDRAL_V38.grammar;
}

function setMarker(scene,label='ROOT'){
  const marker=globalThis?.document?.getElementById?.('build-marker');
  if(!marker)return;
  const player=scene?.player;
  const body=player?.body;
  const grounded=body?.blocked?.down?'G1':'G0';
  marker.textContent=`V48 • ${label} ${grounded} P${Math.round(player?.x||0)},${Math.round(player?.y||0)} H${Math.round(scene?.worldHeight||0)}`;
}

function restoreCathedralWorld(scene,{resetPlayer=false,snapCamera=false}={}){
  if(!isCathedral(scene))return false;
  const layout=scene.environmentLayout;
  const worldWidth=Number(layout?.worldWidth)||CATHEDRAL_V38.worldWidth;
  const worldHeight=Number(layout?.worldHeight)||CATHEDRAL_V38.worldHeight;

  scene.worldWidth=worldWidth;
  scene.worldHeight=worldHeight;
  scene.cameras?.main?.setBounds?.(0,0,worldWidth,worldHeight);
  scene.physics?.world?.setBounds?.(0,0,worldWidth,worldHeight+240);

  if(resetPlayer&&scene.player&&layout?.player){
    const x=Number(layout.player.x)||416;
    const y=Number(layout.player.y)||2368;
    scene.player.setPosition?.(x,y);
    scene.player.body?.reset?.(x,y);
    scene.player.body?.setVelocity?.(0,0);
    scene.player.body?.setAllowGravity?.(true);
    scene.player.body?.setCollideWorldBounds?.(true);
    scene.facing=scene.facing<0?-1:1;

    // Restore the native production protagonist. Previous V41-V47 rescue
    // layers are no longer loaded by main.js, so there is only one actor art.
    scene.pixelArt?.setVisible?.(true);
    scene.pixelArt?.setActive?.(true);
    scene.pixelArt?.setAlpha?.(1);
    scene.updatePixelArt?.(scene.time?.now||0);
  }

  const camera=scene.cameras?.main;
  if(camera&&scene.player){
    camera.startFollow?.(scene.player,true,.085,.11,0,42);
    camera.setDeadzone?.(210,120);
    if(snapCamera){
      camera.centerOn?.(scene.player.x,scene.player.y-42);
      camera.preRender?.();
    }
  }

  return true;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  restoreCathedralWorld(this,{resetPlayer:true,snapCamera:true});
  this.v48MarkerTick=0;
  setMarker(this,'ROOT');
};

const previousRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  previousRebuild.call(this,template);
  restoreCathedralWorld(this,{resetPlayer:false,snapCamera:true});
};

const previousLoadRunNode=GameSceneV38.prototype.loadRunNode;
GameSceneV38.prototype.loadRunNode=function(template,depth,transition=true){
  previousLoadRunNode.call(this,template,depth,transition);
  restoreCathedralWorld(this,{resetPlayer:isCathedral(this),snapCamera:true});
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  // Restore before the inherited update can apply old short-world fall/reset
  // logic, then verify again afterward in case a transition changed bounds.
  restoreCathedralWorld(this,{resetPlayer:false,snapCamera:false});
  previousUpdate.call(this,time,delta);
  restoreCathedralWorld(this,{resetPlayer:false,snapCamera:false});

  if(isCathedral(this)){
    this.pixelArt?.setVisible?.(true);
    this.pixelArt?.setAlpha?.(1);
    if((this.v48MarkerTick=(this.v48MarkerTick||0)+1)%30===0)setMarker(this,'ROOT');
  }
};
