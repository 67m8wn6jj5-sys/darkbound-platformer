import { GameSceneV38 } from './GameSceneV38.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

// V45 keeps the protagonist outside Phaser's renderer, but replaces V44's
// projection math with a camera-preRender + CSS-pixel projection. V44 proved
// the production PNGs load on the live iPhone build (V44 • PROD), so this
// version treats an invisible character as a placement problem, not an asset
// problem. A sanity recovery keeps the actor on-screen if the camera reports a
// bad/non-finite projection during resize/orientation changes.
const ROOT='./assets/v05/pixellab_protagonist';
const FALLBACK='./assets/protagonist-body.svg?v=v45-projection-20260826-1';
const SCALE=.50094;
const PLAYER_FEET_Y=24;
const VERSION='v45-projection-20260826-1';
const DIR_RE='east|west|north|south|north-east|north-west|south-east|south-west';
export const V45_CACHE_BUST=VERSION;

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
  img.style.left='50vw';
  img.style.top='50vh';
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

function projectToCanvas(scene,worldX,worldY){
  const camera=scene.cameras?.main;
  const canvas=scene.game?.canvas;
  if(!camera||!canvas)return null;

  // Phaser updates follow/scroll/worldView during camera preRender. V44 read
  // worldView from update(), which can be stale on Safari/RESIZE. Force the
  // camera to resolve its current follow state before projecting the player.
  camera.preRender?.();

  const rect=canvas.getBoundingClientRect();
  if(!(rect.width>1&&rect.height>1))return null;
  const view=camera.worldView;
  const viewW=Number(view?.width)||Math.max(1,(Number(camera.width)||rect.width)/(Number(camera.zoom)||1));
  const viewH=Number(view?.height)||Math.max(1,(Number(camera.height)||rect.height)/(Number(camera.zoom)||1));
  const viewX=Number(view?.x);
  const viewY=Number(view?.y);
  if(!Number.isFinite(viewX)||!Number.isFinite(viewY)||!Number.isFinite(viewW)||!Number.isFinite(viewH)||viewW<=0||viewH<=0)return null;

  // Main camera fills the Phaser canvas. Normalizing against worldView avoids
  // mixing device pixels, game pixels and CSS pixels under Phaser.Scale.RESIZE.
  const nx=(worldX-viewX)/viewW;
  const ny=(worldY-viewY)/viewH;
  return{
    x:rect.left+nx*rect.width,
    y:rect.top+ny*rect.height,
    rect,
    nx,
    ny,
    zoom:Number(camera.zoom)||1,
  };
}

function positionActive(scene,forceMarker=false){
  const img=scene.v45ActiveNode;
  const info=scene.v45ActiveInfo;
  const player=scene.player;
  if(!img||!info||!player)return false;

  const pad=bottomPadding(scene,info);
  const worldX=Number(player.x);
  const worldY=Number(player.y)+PLAYER_FEET_Y+pad*SCALE;
  if(!Number.isFinite(worldX)||!Number.isFinite(worldY))return false;
  const projected=projectToCanvas(scene,worldX,worldY);
  if(!projected)return false;

  let screenX=projected.x;
  let screenY=projected.y;
  let recovered=false;
  const r=projected.rect;
  const margin=Math.max(96,Math.min(r.width,r.height)*.22);

  // If the player is expected to be camera-followed but Safari hands us a
  // transient off-screen camera projection, keep the art visible at a safe
  // point instead of silently losing the character.
  if(!Number.isFinite(screenX)||!Number.isFinite(screenY)||
     screenX<r.left-margin||screenX>r.right+margin||
     screenY<r.top-margin||screenY>r.bottom+margin){
    screenX=r.left+r.width*.5;
    screenY=r.top+r.height*.62;
    recovered=true;
  }

  const baseW=scene.v45IsFallback?116:Math.max(1,img.naturalWidth||228)*SCALE;
  const baseH=scene.v45IsFallback?154:Math.max(1,img.naturalHeight||228)*SCALE;
  // CSS pixels are already the display coordinate system here. Applying the
  // camera zoom is sufficient; do not scale again by the canvas backing-store
  // ratio (the V44 path did that and could collapse the image on Retina iOS).
  const displayW=Math.max(64,baseW*projected.zoom);
  const displayH=Math.max(64,baseH*projected.zoom);

  img.style.left=`${screenX}px`;
  img.style.top=`${screenY}px`;
  img.style.width=`${displayW}px`;
  img.style.height=`${displayH}px`;
  img.style.transform=`translate3d(-50%,-100%,0) scaleX(${scene.pixelArt?.flipX?-1:1})`;
  img.style.display='block';
  img.style.visibility='visible';
  img.style.opacity='1';

  scene.v45LastScreenX=screenX;
  scene.v45LastScreenY=screenY;
  scene.v45Recovered=recovered;
  if(forceMarker||recovered!==scene.v45LastMarkerRecovered){
    scene.v45LastMarkerRecovered=recovered;
    const x=Math.round(screenX),y=Math.round(screenY);
    setMarker(recovered?`V45 • SAFE x${x} y${y}`:`V45 • PROD x${x} y${y}`);
  }
  return true;
}

function activateNode(scene,img,key,info,isFallback=false){
  const old=scene.v45ActiveNode;
  if(old&&old!==img&&old.parentNode)old.remove();
  if(!img.parentNode)document.body.appendChild(img);
  scene.v45ActiveNode=img;
  scene.v45ActiveKey=key;
  scene.v45ActiveInfo=info;
  scene.v45IsFallback=isFallback;
  document.documentElement.dataset.protagonistArt=isFallback?'fallback-v45':'production-v45';
  document.documentElement.dataset.protagonistTexture=key;
  setMarker(isFallback?'V45 • FALLBACK':'V45 • POSITION');
  positionActive(scene,true);
  requestAnimationFrame(()=>positionActive(scene,true));
}

function requestFallback(scene,key,info){
  if(scene.v45FallbackNode?.complete&&scene.v45FallbackNode.naturalWidth){
    activateNode(scene,scene.v45FallbackNode,key,info,true);
    return;
  }
  if(scene.v45FallbackLoading)return;
  scene.v45FallbackLoading=true;
  const img=styleImage(new Image());
  scene.v45FallbackNode=img;
  img.onload=()=>{
    scene.v45FallbackLoading=false;
    if(scene.v45RequestedKey===key)activateNode(scene,img,key,info,true);
  };
  img.onerror=()=>{
    scene.v45FallbackLoading=false;
    setMarker('V45 • IMAGE ERROR');
    document.documentElement.dataset.protagonistArt='image-error-v45';
  };
  img.src=fallbackUrl();
}

function requestFrame(scene,key,info){
  const url=frameUrl(info);
  const cached=scene.v45FrameCache.get(url);
  if(cached?.complete&&cached.naturalWidth){
    activateNode(scene,cached,key,info,false);
    return;
  }
  if(cached)return;

  const img=styleImage(new Image());
  scene.v45FrameCache.set(url,img);
  img.onload=()=>{
    if(scene.v45RequestedKey===key)activateNode(scene,img,key,info,false);
  };
  img.onerror=()=>{
    scene.v45FrameCache.delete(url);
    if(scene.v45RequestedKey===key)requestFallback(scene,key,info);
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
}

function startIndependentProjectionLoop(scene){
  if(scene.v45Raf)return;
  const tick=()=>{
    scene.v45Raf=0;
    if(scene.sys?.isActive?.()){
      positionActive(scene,false);
      scene.v45Raf=requestAnimationFrame(tick);
    }
  };
  scene.v45Raf=requestAnimationFrame(tick);
}

function ensureFixedProtagonistV45(){
  if(typeof document==='undefined'||!this.player)return null;
  if(!this.v45FrameCache){
    this.v45FrameCache=new Map();
    this.v45RequestedKey='';
    this.v45ActiveKey='';
    this.v45LastMarkerRecovered=null;
    setMarker('V45 • LOADING');
    startIndependentProjectionLoop(this);
    this.events?.once?.('shutdown',()=>{
      if(this.v45Raf)cancelAnimationFrame(this.v45Raf);
      this.v45Raf=0;
      this.v45ActiveNode?.remove?.();
      this.v45FallbackNode?.remove?.();
      for(const node of this.v45FrameCache?.values?.()||[])node?.remove?.();
    });
  }

  suppressLegacy(this);
  const key=typeof this.currentPixelKey==='string'&&this.currentPixelKey?this.currentPixelKey:'px-idle-east-000';
  if(key!==this.v45RequestedKey){
    this.v45RequestedKey=key;
    requestFrame(this,key,frameInfo(key));
  }
  positionActive(this,false);
  return this.v45ActiveNode||null;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  this.ensureFixedProtagonistV45();
};

const previousRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  previousRebuild.call(this,template);
  this.ensureFixedProtagonistV45();
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  this.ensureFixedProtagonistV45();
};

GameSceneV38.prototype.ensureFixedProtagonistV45=ensureFixedProtagonistV45;
