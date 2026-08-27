import { GameSceneV38 } from './GameSceneV38.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

// V47 combines the two things we now know work on iPhone Safari:
// 1) V45's browser-image sizing/projection, which visibly renders production art.
// 2) V46's rule that the art must follow the real Phaser player/camera, never a
//    fake SAFE screen position. This keeps combat, damage and jumping aligned.
const ROOT='./assets/v05/pixellab_protagonist';
const FALLBACK='./assets/protagonist-body.svg?v=v47-visible-physics-sync-20260827-1';
const SCALE=.50094;
const PLAYER_FEET_Y=24;
const VERSION='v47-visible-physics-sync-20260827-1';
const DIR_RE='east|west|north|south|north-east|north-west|south-east|south-west';
export const V47_CACHE_BUST=VERSION;

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
  Object.assign(img.style,{
    position:'fixed',left:'50vw',top:'50vh',display:'block',visibility:'visible',opacity:'1',
    pointerEvents:'none',userSelect:'none',webkitUserSelect:'none',maxWidth:'none',maxHeight:'none',
    margin:'0',padding:'0',border:'0',zIndex:'99990',transformOrigin:'50% 100%',
    willChange:'left,top,width,height,transform',contain:'layout style paint'
  });
  return img;
}

function ensureCameraTracksPlayer(scene,snap=false){
  const camera=scene.cameras?.main;
  const player=scene.player;
  if(!camera||!player)return;
  if(camera._follow!==player){
    camera.startFollow(player,true,.085,.11,0,42);
    camera.setDeadzone(210,120);
    snap=true;
  }
  if(snap){
    camera.preRender?.();
    camera.centerOn?.(player.x,player.y-42);
    camera.preRender?.();
  }
}

// Use Phaser's resolved worldView exactly as V45 did. This is the path that
// visibly rendered on the user's iPhone. Unlike V45, there is no SAFE fallback:
// if the player moves, jumps or is hit, the image moves with the physics body.
function projectPlayerToCss(scene,worldX,worldY){
  const camera=scene.cameras?.main;
  const canvas=scene.game?.canvas;
  if(!camera||!canvas)return null;
  camera.preRender?.();
  const rect=canvas.getBoundingClientRect();
  if(!(rect.width>1&&rect.height>1))return null;
  const view=camera.worldView;
  const viewW=Number(view?.width)||Math.max(1,(Number(camera.width)||rect.width)/(Number(camera.zoom)||1));
  const viewH=Number(view?.height)||Math.max(1,(Number(camera.height)||rect.height)/(Number(camera.zoom)||1));
  const viewX=Number(view?.x),viewY=Number(view?.y);
  if(!Number.isFinite(viewX)||!Number.isFinite(viewY)||!(viewW>0&&viewH>0))return null;
  const nx=(worldX-viewX)/viewW;
  const ny=(worldY-viewY)/viewH;
  return{
    x:rect.left+nx*rect.width,
    y:rect.top+ny*rect.height,
    rect,
    zoom:Number(camera.zoom)||1,
    nx,ny,
  };
}

function positionActive(scene,forceMarker=false){
  const img=scene.v47ActiveNode;
  const info=scene.v47ActiveInfo;
  const player=scene.player;
  if(!img||!info||!player)return false;

  ensureCameraTracksPlayer(scene,false);
  const pad=bottomPadding(scene,info);
  const worldX=Number(player.x);
  const worldY=Number(player.y)+PLAYER_FEET_Y+pad*SCALE;
  if(!Number.isFinite(worldX)||!Number.isFinite(worldY))return false;
  const projected=projectPlayerToCss(scene,worldX,worldY);
  if(!projected)return false;

  // Keep the proven V45 CSS sizing. Do not multiply by backing-store or
  // scene-scale ratios; Safari/Retina can otherwise collapse the sprite.
  const baseW=scene.v47IsFallback?116:Math.max(1,img.naturalWidth||228)*SCALE;
  const baseH=scene.v47IsFallback?154:Math.max(1,img.naturalHeight||228)*SCALE;
  const displayW=Math.max(64,baseW*projected.zoom);
  const displayH=Math.max(64,baseH*projected.zoom);
  const flip=(scene.pixelArt?.flipX||scene.facing<0)?-1:1;

  img.style.left=`${projected.x}px`;
  img.style.top=`${projected.y}px`;
  img.style.width=`${displayW}px`;
  img.style.height=`${displayH}px`;
  img.style.transform=`translate3d(-50%,-100%,0) scaleX(${flip})`;
  img.style.display='block';
  img.style.visibility='visible';
  img.style.opacity='1';

  const grounded=scene.player?.body?.blocked?.down?'G1':'G0';
  if(forceMarker||scene.v47MarkerTick++%30===0){
    setMarker(`V47 • LIVE ${grounded} P${Math.round(player.x)},${Math.round(player.y)} S${Math.round(projected.x)},${Math.round(projected.y)} W${Math.round(displayW)}`);
  }
  return true;
}

function activateNode(scene,img,key,info,isFallback=false){
  const old=scene.v47ActiveNode;
  if(old&&old!==img&&old.parentNode)old.remove();
  if(!img.parentNode)document.body.appendChild(img);
  scene.v47ActiveNode=img;
  scene.v47ActiveKey=key;
  scene.v47ActiveInfo=info;
  scene.v47IsFallback=isFallback;
  document.documentElement.dataset.protagonistArt=isFallback?'fallback-v47':'production-v47';
  document.documentElement.dataset.protagonistTexture=key;
  positionActive(scene,true);
  requestAnimationFrame(()=>positionActive(scene,true));
}

function requestFallback(scene,key,info){
  if(scene.v47FallbackNode?.complete&&scene.v47FallbackNode.naturalWidth){
    activateNode(scene,scene.v47FallbackNode,key,info,true);return;
  }
  if(scene.v47FallbackLoading)return;
  scene.v47FallbackLoading=true;
  const img=styleImage(new Image());
  scene.v47FallbackNode=img;
  img.onload=()=>{scene.v47FallbackLoading=false;if(scene.v47RequestedKey===key)activateNode(scene,img,key,info,true);};
  img.onerror=()=>{scene.v47FallbackLoading=false;setMarker('V47 • IMAGE ERROR');};
  img.src=fallbackUrl();
}

function requestFrame(scene,key,info){
  const url=frameUrl(info);
  const cached=scene.v47FrameCache.get(url);
  if(cached?.complete&&cached.naturalWidth){activateNode(scene,cached,key,info,false);return;}
  if(cached)return;
  const img=styleImage(new Image());
  scene.v47FrameCache.set(url,img);
  img.onload=()=>{if(scene.v47RequestedKey===key)activateNode(scene,img,key,info,false);};
  img.onerror=()=>{scene.v47FrameCache.delete(url);if(scene.v47RequestedKey===key)requestFallback(scene,key,info);};
  img.src=url;
}

function suppressLegacy(scene){
  scene.pixelArt?.setVisible?.(false);
  scene.v42ProtagonistArt?.setVisible?.(false);
  scene.v41ProtagonistArt?.setVisible?.(false);
  scene.v40ProtagonistArt?.setVisible?.(false);
  scene.v43ProtagonistDom?.setVisible?.(false);
  for(const key of ['v43ProtagonistNode','v44ActiveNode','v45ActiveNode','v46ActiveNode']){
    if(scene[key])scene[key].style.display='none';
  }
}

function startLoop(scene){
  if(scene.v47Raf)return;
  const tick=()=>{
    scene.v47Raf=0;
    if(scene.sys?.isActive?.()){
      positionActive(scene,false);
      scene.v47Raf=requestAnimationFrame(tick);
    }
  };
  scene.v47Raf=requestAnimationFrame(tick);
}

function ensureVisibleSyncedProtagonistV47(snapCamera=false){
  if(typeof document==='undefined'||!this.player)return null;
  if(!this.v47FrameCache){
    this.v47FrameCache=new Map();
    this.v47RequestedKey='';
    this.v47ActiveKey='';
    this.v47MarkerTick=0;
    setMarker('V47 • LOADING');
    ensureCameraTracksPlayer(this,true);
    startLoop(this);
    this.events?.once?.('shutdown',()=>{
      if(this.v47Raf)cancelAnimationFrame(this.v47Raf);
      this.v47Raf=0;
      this.v47ActiveNode?.remove?.();this.v47FallbackNode?.remove?.();
      for(const node of this.v47FrameCache?.values?.()||[])node?.remove?.();
    });
  }
  ensureCameraTracksPlayer(this,snapCamera);
  suppressLegacy(this);
  const key=typeof this.currentPixelKey==='string'&&this.currentPixelKey?this.currentPixelKey:'px-idle-east-000';
  if(key!==this.v47RequestedKey){
    this.v47RequestedKey=key;
    requestFrame(this,key,frameInfo(key));
  }
  positionActive(this,false);
  return this.v47ActiveNode||null;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){previousCreate.call(this);this.ensureVisibleSyncedProtagonistV47(true);};
const previousRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){previousRebuild.call(this,template);this.ensureVisibleSyncedProtagonistV47(true);};
const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){previousUpdate.call(this,time,delta);this.ensureVisibleSyncedProtagonistV47(false);};
GameSceneV38.prototype.ensureVisibleSyncedProtagonistV47=ensureVisibleSyncedProtagonistV47;
