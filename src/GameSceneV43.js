import { GameSceneV38 } from './GameSceneV38.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

// V43 bypasses Phaser's texture renderer for the protagonist entirely.
// The animation state still comes from the existing gameplay runtime, but the
// actual frame is displayed by a normal browser <img> inside Phaser's DOM layer.
// This isolates iOS/Safari from the texture/display-object failure that left the
// player physics actor movable while the production art disappeared.
const ROOT='./assets/v05/pixellab_protagonist';
const FALLBACK='./assets/protagonist-body.svg?v=v43-dom-renderer-20260824-1';
const SCALE=.50094;
const PLAYER_FEET_Y=24;
const DIR_RE='east|west|north|south|north-east|north-west|south-east|south-west';
export const V43_CACHE_BUST='v43-dom-renderer-20260824-1';

function frameInfo(key){
  let match=key?.match?.(new RegExp(`^px-rotation-(.+)-(${DIR_RE})$`));
  if(match)return{kind:'rotation',source:match[1],direction:match[2]};
  match=key?.match?.(/^px-(.+)-(east|west)-(\d{3})$/);
  if(match)return{kind:'frame',action:match[1],direction:match[2],index:Number(match[3])};
  return{kind:'frame',action:'idle',direction:'east',index:0};
}

function urlFor(info){
  if(info.kind==='rotation')return`${ROOT}/${info.source}/rotations/${info.direction}.png?v=v43-dom-renderer-20260824-1`;
  return`${ROOT}/${info.action}/${info.direction}/frame_${String(info.index).padStart(3,'0')}.png?v=v43-dom-renderer-20260824-1`;
}

function bottomPadding(scene,info){
  if(info.kind==='rotation'){
    const meta=PIXELLAB_MANIFEST[scene.pixelState]||Object.values(PIXELLAB_MANIFEST).find(item=>item?.rotationSource===info.source);
    return Number(meta?.rotationBottomPadding?.[info.direction])||0;
  }
  return Number(PIXELLAB_MANIFEST[info.action]?.frameBottomPadding?.[info.direction]?.[info.index])||0;
}

function ensureDomProtagonistV43(){
  if(typeof document==='undefined'||!this.player||!this.add?.dom)return null;

  if(!this.v43ProtagonistDom||!this.v43ProtagonistDom.scene){
    const img=document.createElement('img');
    img.alt='';
    img.draggable=false;
    img.decoding='async';
    img.style.display='block';
    img.style.pointerEvents='none';
    img.style.userSelect='none';
    img.style.webkitUserSelect='none';
    img.style.maxWidth='none';
    img.style.maxHeight='none';
    img.style.transformOrigin='50% 100%';
    img.style.willChange='transform';
    img.dataset.v43Fallback='0';
    img.onload=()=>{
      if(img.dataset.v43Fallback==='1')return;
      img.style.width=`${Math.max(1,img.naturalWidth*SCALE)}px`;
      img.style.height=`${Math.max(1,img.naturalHeight*SCALE)}px`;
    };
    img.onerror=()=>{
      if(img.dataset.v43Fallback==='1')return;
      img.dataset.v43Fallback='1';
      img.src=FALLBACK;
      img.style.width='116px';
      img.style.height='154px';
      document.documentElement.dataset.protagonistArt='fallback-dom';
    };

    this.v43ProtagonistNode=img;
    this.v43ProtagonistDom=this.add.dom(this.player.x,this.player.y+PLAYER_FEET_Y,img)
      .setOrigin(.5,1)
      .setDepth(10000)
      .setScrollFactor(1,1)
      .setVisible(true)
      .setActive(true);
    this.v43LastKey='';
  }

  const key=typeof this.currentPixelKey==='string'&&this.currentPixelKey?this.currentPixelKey:'px-idle-east-000';
  const info=frameInfo(key);
  const pad=bottomPadding(this,info);
  const dom=this.v43ProtagonistDom;
  const img=this.v43ProtagonistNode;

  if(key!==this.v43LastKey){
    this.v43LastKey=key;
    img.dataset.v43Fallback='0';
    img.src=urlFor(info);
    document.documentElement.dataset.protagonistArt='production-dom';
    document.documentElement.dataset.protagonistTexture=key;
  }

  img.style.transform=this.pixelArt?.flipX?'scaleX(-1)':'scaleX(1)';
  dom
    .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y+pad*SCALE)
    .setOrigin(.5,1)
    .setDepth(10000)
    .setScrollFactor(1,1)
    .setVisible(true)
    .setActive(true);

  // Suppress every canvas-based protagonist renderer. Gameplay/physics remain
  // attached to the player container; only visual presentation moves to DOM.
  this.pixelArt?.setVisible?.(false);
  this.v42ProtagonistArt?.setVisible?.(false);
  this.v41ProtagonistArt?.setVisible?.(false);
  this.v40ProtagonistArt?.setVisible?.(false);
  return dom;
}

const previousCreate=GameSceneV38.prototype.create;
GameSceneV38.prototype.create=function(){
  previousCreate.call(this);
  this.ensureDomProtagonistV43();
};

const previousRebuild=GameSceneV38.prototype.rebuildRoomLayout;
GameSceneV38.prototype.rebuildRoomLayout=function(template){
  previousRebuild.call(this,template);
  this.ensureDomProtagonistV43();
};

const previousUpdate=GameSceneV38.prototype.update;
GameSceneV38.prototype.update=function(time,delta){
  previousUpdate.call(this,time,delta);
  this.ensureDomProtagonistV43();
};

GameSceneV38.prototype.ensureDomProtagonistV43=ensureDomProtagonistV43;
