import { GameSceneV38 } from './GameSceneV38.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

// V44 removes Phaser's DOMElement renderer from the protagonist path entirely.
// The physics and animation state still live in Phaser, but the visible artwork
// is a normal fixed-position browser image appended directly to document.body.
// This avoids both the WebGL/canvas protagonist failure and iOS Safari issues
// with Phaser's DOM overlay container.
const ROOT='./assets/v05/pixellab_protagonist';
const FALLBACK='./assets/protagonist-body.svg?v=v44-fixed-overlay-20260825-1';
const SCALE=.50094;
const PLAYER_FEET_Y=24;
const VERSION='v44-fixed-overlay-20260825-1';
const DIR_RE='east|west|north|south|north-east|north-west|south-east|south-west';
export const V44_CACHE_BUST=VERSION;

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
  img.style.left='0px';
  img.style.top='0px';
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
  return img;
}

function activateNode(scene,img,key,info,isFallback=false){
  const old=scene.v44ActiveNode;
  if(old&&old!==img&&old.parentNode)old.remove();
  if(!img.parentNode)document.body.appendChild(img);
  scene.v44ActiveNode=img;
  scene.v44ActiveKey=key;
  scene.v44ActiveInfo=info;
  scene.v44IsFallback=isFallback;
  document.documentElement.dataset.protagonistArt=isFallback?'fallback-fixed':'production-fixed';
  document.documentElement.dataset.protagonistTexture=key;
  setMarker(isFallback?'V44 • FALLBACK':'V44 • PROD');
}

function requestFallback(scene,key,info){
  if(scene.v44FallbackNode?.complete&&scene.v44FallbackNode.naturalWidth){
    activateNode(scene,scene.v44FallbackNode,key,info,true);
    return;
  }
  if(scene.v44FallbackLoading)return;
  scene.v44FallbackLoading=true;
  const img=styleImage(new Image());
  scene.v44FallbackNode=img;
  img.onload=()=>{
    scene.v44FallbackLoading=false;
    if(scene.v44RequestedKey===key)activateNode(scene,img,key,info,true);
  };
  img.onerror=()=>{
    scene.v44FallbackLoading=false;
    setMarker('V44 • IMAGE ERROR');
    document.documentElement.dataset.protagonistArt='image-error';
  };
  img.src=fallbackUrl();
}

function requestFrame(scene,key,info){
  const url=frameUrl(info);
  const cached=scene.v44FrameCache.get(url);
  if(cached?.complete&&cached.naturalWidth){
    activateNode(scene,cached,key,info,false);
    return;
  }
  if(cached)return;

  const img=styleImage(new Image());
  scene.v44FrameCache.set(url,img);
  img.onload=()=>{
    if(scene.v44RequestedKey===key)activateNode(scene,img,key,info,false);
  };
  img.onerror=()=>{
    scene.v44FrameCache.delete(url);
    if(scene.v44RequestedKey===key)requestFallback(scene,key,info);
  };
  img.src=url;
}

function positionActive(scene){
  const img=scene.v44ActiveNode;
  const info=scene.v44ActiveInfo;
  const player=scene.player;
  const camera=scene.cameras?.main;
  const canvas=scene.game?.canvas;
  if(!img||!info||!player||!camera||!canvas)return;

  const rect=canvas.getBoundingClientRect();
  const logicalWidth=Math.max(1,scene.scale?.width||rect.width||1);
  const logicalHeight=Math.max(1,scene.scale?.height||rect.height||1);
  const cssX=rect.width/logicalWidth;
  const cssY=rect.height/logicalHeight;
  const zoom=Number(camera.zoom)||1;
  const pad=bottomPadding(scene,info);
  const worldX=player.x;
  const worldY=player.y+PLAYER_FEET_Y+pad*SCALE;
  const view=camera.worldView;
  const screenX=rect.left+(camera.x+(worldX-view.x)*zoom)*cssX;
  const screenY=rect.top+(camera.y+(worldY-view.y)*zoom)*cssY;

  const baseW=scene.v44IsFallback?116:Math.max(1,img.naturalWidth||228)*SCALE;
  const baseH=scene.v44IsFallback?154:Math.max(1,img.naturalHeight||228)*SCALE;
  img.style.left=`${screenX}px`;
  img.style.top=`${screenY}px`;
  img.style.width=`${Math.max(1,baseW*zoom*cssX)}px`;
  img.style.height=`${Math.max(1,baseH*zoom*cssY)}px`;
  img.style.transform=`translate(-50%,-100%) scaleX(${scene.pixelArt?.flipX?-1:1})`;
}

function suppressLegacy(scene){
  scene.pixelArt?.setVisible?.(false);
  scene.v42ProtagonistArt?.setVisible?.(false);
  scene.v41ProtagonistArt?.setVisible?.(false);
  scene.v40ProtagonistArt?.setVisible?.(false);
  scene.v43ProtagonistDom?.setVisible?.(false);
  if(scene.v43ProtagonistNode)scene.v43ProtagonistNode.style.display='none';
}

function ensureFixedProtagonistV44(){
  if(typeof document==='undefined'||!this.player)return null;
  if(!this.v44FrameCache){
    this.v44FrameCache=new Map();
    this.v44RequestedKey='';
    this.v44ActiveKey='';
    setMarker('V44 • LOADING');
    this.events?.once?.('shutdown',()=>{
      this.v44ActiveNode?.remove?.();
      this.v44FallbackNode?.remove?.();
      for(const node of this.v44FrameCache?.values?.()||[])node?.remove?.();
    });
  }

  suppressLegacy(this);
  const key=typeof this.currentPixelKey==='string'&&this.currentPixelKey?this.currentPixelKey:'px-idle-east-000';
  if(key!==this.v44RequestedKey){
    this.v44RequestedKey=key;
    requestFrame(this,key,frameInfo(key));
  }
  positionActive(this);
  return this.v44ActiveNode||null;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  this.ensureFixedProtagonistV44();
};

const previousRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  previousRebuild.call(this,template);
  this.ensureFixedProtagonistV44();
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  this.ensureFixedProtagonistV44();
};

GameSceneV38.prototype.ensureFixedProtagonistV44=ensureFixedProtagonistV44;
