import { GameSceneV38 } from './GameSceneV38.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

// V46 keeps the proven browser-image protagonist renderer, but removes V45's
// SAFE screen-center fallback. That fallback made the art visible while the
// real Phaser physics body remained somewhere else, so attacks, damage and
// jumping appeared disconnected. V46 projects the live player body directly
// from the camera scroll/zoom into CSS coordinates and keeps the camera follow
// target explicitly bound to the same player object.
const ROOT='./assets/v05/pixellab_protagonist';
const FALLBACK='./assets/protagonist-body.svg?v=v46-physics-sync-20260826-1';
const SCALE=.50094;
const PLAYER_FEET_Y=24;
const VERSION='v46-physics-sync-20260826-1';
const DIR_RE='east|west|north|south|north-east|north-west|south-east|south-west';
export const V46_CACHE_BUST=VERSION;

function frameInfo(key){
  let match=key?.match?.(new RegExp(`^px-rotation-(.+)-(${DIR_RE})$`));
  if(match)return{kind:'rotation',source:match[1],direction:match[2]};
  match=key?.match?.(/^px-(.+)-(east|west)-(\d{3})$/);
  if(match)return{kind:'frame',action:match[1],direction:match[2],index:Number(match[3])};
  return{kind:'frame',action:'idle',direction:'east',index:0};
}

function frameUrl(info){
  const relative=info.kind==='rotation'
    ?`${ROOT}/${info.source}/rotations/${info.direction}.png?v=${VERSION}`
    :`${ROOT}/${info.action}/${info.direction}/frame_${String(info.index).padStart(3,'0')}.png?v=${VERSION}`;
  return new URL(relative,document.baseURI).href;
}

function fallbackUrl(){return new URL(FALLBACK,document.baseURI).href;}

function bottomPadding(scene,info){
  if(info.kind==='rotation'){
    const meta=PIXELLAB_MANIFEST[scene.pixelState]||Object.values(PIXELLAB_MANIFEST).find(item=>item?.rotationSource===info.source);
    return Number(meta?.rotationBottomPadding?.[info.direction])||0;
  }
  return Number(PIXELLAB_MANIFEST[info.action]?.frameBottomPadding?.[info.direction]?.[info.index])||0;
}

function setMarker(text){
  const marker=document.getElementById('build-marker');
  if(marker)marker.textContent=text;
}

function styleImage(img){
  img.alt='';
  img.draggable=false;
  img.fetchPriority='high';
  img.style.position='fixed';
  img.style.left='0';
  img.style.top='0';
  img.style.display='block';
  img.style.visibility='visible';
  img.style.opacity='1';
  img.style.pointerEvents='none';
  img.style.userSelect='none';
  img.style.webkitUserSelect='none';
  img.style.maxWidth='none';
  img.style.maxHeight='none';
  img.style.margin='0';
  img.style.padding='0';
  img.style.border='0';
  img.style.zIndex='99990';
  img.style.transformOrigin='50% 100%';
  img.style.willChange='left,top,width,height,transform';
  img.style.contain='layout style paint';
  return img;
}

function ensureCameraTracksPlayer(scene,snap=false){
  const camera=scene.cameras?.main;
  const player=scene.player;
  if(!camera||!player)return;

  // Keep the rendered world and physics body on the same target. V36 normally
  // does this already, but explicitly restoring it here protects the mobile
  // resize/orientation path that originally exposed the mismatch.
  if(camera._follow!==player){
    camera.startFollow(player,true,.085,.11,0,42);
    camera.setDeadzone(210,120);
    snap=true;
  }

  if(snap){
    const zoomX=Number(camera.zoomX)||Number(camera.zoom)||1;
    const zoomY=Number(camera.zoomY)||Number(camera.zoom)||1;
    const viewW=(Number(camera.width)||scene.scale?.width||1)/zoomX;
    const viewH=(Number(camera.height)||scene.scale?.height||1)/zoomY;
    const maxX=Math.max(0,(Number(scene.worldWidth)||viewW)-viewW);
    const maxY=Math.max(0,(Number(scene.worldHeight)||viewH)-viewH);
    const targetScrollX=player.x-viewW*.5;
    const targetScrollY=(player.y-42)-viewH*.5;
    camera.scrollX=Math.max(0,Math.min(maxX,targetScrollX));
    camera.scrollY=Math.max(0,Math.min(maxY,targetScrollY));
  }
}

function projectWorldToCss(scene,worldX,worldY){
  const camera=scene.cameras?.main;
  const canvas=scene.game?.canvas;
  if(!camera||!canvas)return null;

  const rect=canvas.getBoundingClientRect();
  if(!(rect.width>1&&rect.height>1))return null;

  const gameW=Math.max(1,Number(scene.scale?.width)||Number(camera.width)||rect.width);
  const gameH=Math.max(1,Number(scene.scale?.height)||Number(camera.height)||rect.height);
  const cssPerGameX=rect.width/gameW;
  const cssPerGameY=rect.height/gameH;
  const zoomX=Number(camera.zoomX)||Number(camera.zoom)||1;
  const zoomY=Number(camera.zoomY)||Number(camera.zoom)||1;
  const camW=Number(camera.width)||gameW;
  const camH=Number(camera.height)||gameH;
  const originX=camW*(Number(camera.originX)||0);
  const originY=camH*(Number(camera.originY)||0);
  const scrollX=Number(camera.scrollX);
  const scrollY=Number(camera.scrollY);
  if(!Number.isFinite(scrollX)||!Number.isFinite(scrollY))return null;

  // This mirrors Phaser Camera.preRender's no-rotation transform: world
  // coordinates first subtract camera scroll, then scale around the camera
  // origin, then enter the viewport. The final conversion is game pixels ->
  // CSS pixels, so Retina backing-store size never enters the calculation.
  const localX=worldX-scrollX;
  const localY=worldY-scrollY;
  const gameX=(Number(camera.x)||0)+originX+(localX-originX)*zoomX;
  const gameY=(Number(camera.y)||0)+originY+(localY-originY)*zoomY;

  return{
    x:rect.left+gameX*cssPerGameX,
    y:rect.top+gameY*cssPerGameY,
    cssPerGameX,
    cssPerGameY,
    zoomX,
    zoomY,
    rect,
  };
}

function positionActive(scene,forceMarker=false){
  const img=scene.v46ActiveNode;
  const info=scene.v46ActiveInfo;
  const player=scene.player;
  if(!img||!info||!player)return false;

  ensureCameraTracksPlayer(scene,false);

  const pad=bottomPadding(scene,info);
  const worldX=Number(player.x);
  const worldY=Number(player.y)+PLAYER_FEET_Y+pad*SCALE;
  if(!Number.isFinite(worldX)||!Number.isFinite(worldY))return false;

  const projected=projectWorldToCss(scene,worldX,worldY);
  if(!projected)return false;

  const baseW=scene.v46IsFallback?116:Math.max(1,img.naturalWidth||228)*SCALE;
  const baseH=scene.v46IsFallback?154:Math.max(1,img.naturalHeight||228)*SCALE;
  const displayW=Math.max(36,baseW*projected.zoomX*projected.cssPerGameX);
  const displayH=Math.max(36,baseH*projected.zoomY*projected.cssPerGameY);

  img.style.left=`${projected.x}px`;
  img.style.top=`${projected.y}px`;
  img.style.width=`${displayW}px`;
  img.style.height=`${displayH}px`;
  img.style.transform=`translate3d(-50%,-100%,0) scaleX(${scene.pixelArt?.flipX||scene.facing<0?-1:1})`;
  img.style.display='block';
  img.style.visibility='visible';
  img.style.opacity='1';

  scene.v46LastScreenX=projected.x;
  scene.v46LastScreenY=projected.y;
  const grounded=scene.player?.body?.blocked?.down?'G1':'G0';
  if(forceMarker||scene.v46MarkerTick++%30===0){
    setMarker(`V46 • SYNC ${grounded} P${Math.round(player.x)},${Math.round(player.y)} S${Math.round(projected.x)},${Math.round(projected.y)}`);
  }
  return true;
}

function activateNode(scene,img,key,info,isFallback=false){
  const old=scene.v46ActiveNode;
  if(old&&old!==img&&old.parentNode)old.remove();
  if(!img.parentNode)document.body.appendChild(img);
  scene.v46ActiveNode=img;
  scene.v46ActiveKey=key;
  scene.v46ActiveInfo=info;
  scene.v46IsFallback=isFallback;
  document.documentElement.dataset.protagonistArt=isFallback?'fallback-v46':'production-v46';
  document.documentElement.dataset.protagonistTexture=key;
  positionActive(scene,true);
  requestAnimationFrame(()=>positionActive(scene,true));
}

function requestFallback(scene,key,info){
  if(scene.v46FallbackNode?.complete&&scene.v46FallbackNode.naturalWidth){
    activateNode(scene,scene.v46FallbackNode,key,info,true);
    return;
  }
  if(scene.v46FallbackLoading)return;
  scene.v46FallbackLoading=true;
  const img=styleImage(new Image());
  scene.v46FallbackNode=img;
  img.onload=()=>{
    scene.v46FallbackLoading=false;
    if(scene.v46RequestedKey===key)activateNode(scene,img,key,info,true);
  };
  img.onerror=()=>{
    scene.v46FallbackLoading=false;
    setMarker('V46 • IMAGE ERROR');
    document.documentElement.dataset.protagonistArt='image-error-v46';
  };
  img.src=fallbackUrl();
}

function requestFrame(scene,key,info){
  const url=frameUrl(info);
  const cached=scene.v46FrameCache.get(url);
  if(cached?.complete&&cached.naturalWidth){
    activateNode(scene,cached,key,info,false);
    return;
  }
  if(cached)return;

  const img=styleImage(new Image());
  scene.v46FrameCache.set(url,img);
  img.onload=()=>{
    if(scene.v46RequestedKey===key)activateNode(scene,img,key,info,false);
  };
  img.onerror=()=>{
    scene.v46FrameCache.delete(url);
    if(scene.v46RequestedKey===key)requestFallback(scene,key,info);
  };
  img.src=url;
}

function suppressLegacy(scene){
  scene.pixelArt?.setVisible?.(false);
  scene.v42ProtagonistArt?.setVisible?.(false);
  scene.v41ProtagonistArt?.setVisible?.(false);
  scene.v40ProtagonistArt?.setVisible?.(false);
  scene.v43ProtagonistDom?.setVisible?.(false);
  if(scene.v43ProtagonistNode)scene.v43ProtagonistNode.style.display='none';
  if(scene.v44ActiveNode)scene.v44ActiveNode.style.display='none';
  if(scene.v45ActiveNode)scene.v45ActiveNode.style.display='none';
}

function startProjectionLoop(scene){
  if(scene.v46Raf)return;
  const tick=()=>{
    scene.v46Raf=0;
    if(scene.sys?.isActive?.()){
      positionActive(scene,false);
      scene.v46Raf=requestAnimationFrame(tick);
    }
  };
  scene.v46Raf=requestAnimationFrame(tick);
}

function ensureSyncedProtagonistV46(snapCamera=false){
  if(typeof document==='undefined'||!this.player)return null;
  if(!this.v46FrameCache){
    this.v46FrameCache=new Map();
    this.v46RequestedKey='';
    this.v46ActiveKey='';
    this.v46MarkerTick=0;
    setMarker('V46 • LOADING');
    ensureCameraTracksPlayer(this,true);
    startProjectionLoop(this);
    this.events?.once?.('shutdown',()=>{
      if(this.v46Raf)cancelAnimationFrame(this.v46Raf);
      this.v46Raf=0;
      this.v46ActiveNode?.remove?.();
      this.v46FallbackNode?.remove?.();
      for(const node of this.v46FrameCache?.values?.()||[])node?.remove?.();
    });
  }

  ensureCameraTracksPlayer(this,snapCamera);
  suppressLegacy(this);
  const key=typeof this.currentPixelKey==='string'&&this.currentPixelKey?this.currentPixelKey:'px-idle-east-000';
  if(key!==this.v46RequestedKey){
    this.v46RequestedKey=key;
    requestFrame(this,key,frameInfo(key));
  }
  positionActive(this,false);
  return this.v46ActiveNode||null;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  this.ensureSyncedProtagonistV46(true);
};

const previousRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  previousRebuild.call(this,template);
  this.ensureSyncedProtagonistV46(true);
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  this.ensureSyncedProtagonistV46(false);
};

GameSceneV38.prototype.ensureSyncedProtagonistV46=ensureSyncedProtagonistV46;
