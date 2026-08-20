import { GameSceneV21 } from './GameSceneV21.js';

export const GOTHIC_TILE_SIZE=32;
export const GOTHIC_TILESET_KEY='gothic-ruins-terrain-v1';
export const GOTHIC_TILESET_PATH='./pixellab-tileset-ancient-dark-gothic-stone-masonry-large-a89e3ba5.png?v=gothic-ruins-v1';
export const ARENA_GRID_LEFT=416;
export const ARENA_GRID_RIGHT=1728;
export const ARENA_FLOOR_Y=640;

// PixelLab compact dual-grid 15-tileset row-major order.
// Each entry is the Wang corner mask stored in that frame.
export const PIXELLAB_MASK_ORDER=Object.freeze([
  13,10,4,12,
  6,8,0,1,
  11,3,2,5,
  15,14,9,7,
]);
export const PIXELLAB_FRAME_BY_MASK=Object.freeze((()=>{
  const frames=Array(16).fill(0);
  PIXELLAB_MASK_ORDER.forEach((mask,frame)=>{frames[mask]=frame;});
  return frames;
})());

const GRAMMAR_LABELS=Object.freeze({
  staircase:'SHATTERED STAIR',
  split:'SPLIT CRYPT',
  perches:'WATCHER PERCHES',
  zigzag:'BROKEN ASCENT',
  lowbridge:'FALLEN GALLERY',
  boss:'MOON PIT',
});

function mixSeed(seed,depth,text=''){
  let h=((Number(seed)||1)>>>0)^Math.imul((depth+1)>>>0,0x9e3779b1);
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,0x01000193);
  }
  h^=h>>>16;
  h=Math.imul(h,0x7feb352d);
  h^=h>>>15;
  h=Math.imul(h,0x846ca68b);
  h^=h>>>16;
  return h>>>0;
}

function mulberry32(seed){
  let a=seed>>>0;
  return()=>{
    a=(a+0x6D2B79F5)>>>0;
    let t=a;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return((t^(t>>>14))>>>0)/4294967296;
  };
}

function randInt(rng,min,max){return min+Math.floor(rng()*(max-min+1));}
function pick(rng,values){return values[Math.min(values.length-1,Math.floor(rng()*values.length))];}
function cells(n){return n*GOTHIC_TILE_SIZE;}
function snap(value){return Math.round(value/GOTHIC_TILE_SIZE)*GOTHIC_TILE_SIZE;}
function platform(x,y,wCells){return{x:snap(x),y:snap(y),w:cells(wCells),h:GOTHIC_TILE_SIZE};}

function grammarPlatforms(grammar,rng){
  const j=()=>cells(randInt(rng,-1,1));
  const w=()=>randInt(rng,5,7);
  if(grammar==='staircase'){
    return[
      platform(672+j(),544,w()),
      platform(960+j(),480,w()),
      platform(1248+j(),416,w()),
    ];
  }
  if(grammar==='split'){
    return[
      platform(672+j(),512,w()),
      platform(992+j(),416,randInt(rng,6,8)),
      platform(1344+j(),512,w()),
    ];
  }
  if(grammar==='perches'){
    return[
      platform(704+j(),480,w()),
      platform(1056+j(),384,randInt(rng,6,8)),
      platform(1408+j(),480,randInt(rng,5,6)),
    ];
  }
  if(grammar==='zigzag'){
    return[
      platform(640+j(),544,randInt(rng,5,6)),
      platform(896+j(),448,w()),
      platform(1152+j(),512,w()),
      platform(1408+j(),416,randInt(rng,5,6)),
    ];
  }
  return[
    platform(672+j(),544,randInt(rng,6,8)),
    platform(992+j(),512,randInt(rng,5,7)),
    platform(1280+j(),544,randInt(rng,6,8)),
  ];
}

function clampPlatform(spec){
  const minX=ARENA_GRID_LEFT+cells(4);
  const maxRight=ARENA_GRID_RIGHT-cells(2);
  const x=Math.max(minX,Math.min(spec.x,maxRight-spec.w));
  return{...spec,x:snap(x),y:snap(Math.max(352,Math.min(544,spec.y)))};
}

function makeSpawnPools(platforms,rng){
  const groundXs=[832,1120,1472].map(x=>snap(x+cells(randInt(rng,-1,1))));
  const ground=groundXs.map(x=>({x,y:560,minX:x-96,maxX:x+96,kind:'ground'}));
  const perches=[...platforms]
    .sort((a,b)=>a.y-b.y||a.x-b.x)
    .map(spec=>({
      x:snap(spec.x+spec.w/2),
      y:spec.y-40,
      minX:spec.x+24,
      maxX:spec.x+spec.w-24,
      kind:'perch',
    }));
  return{ground,perches};
}

export function generateProceduralRoom(seed,depth=0,templateId='duel'){
  const roomSeed=mixSeed(seed,depth,templateId);
  const rng=mulberry32(roomSeed);
  const early=depth===0?['staircase','split','lowbridge']:['staircase','split','perches','zigzag','lowbridge'];
  const grammar=pick(rng,early);
  const platforms=grammarPlatforms(grammar,rng).map(clampPlatform);
  const floor={x:ARENA_GRID_LEFT,y:ARENA_FLOOR_Y,w:ARENA_GRID_RIGHT-ARENA_GRID_LEFT,h:cells(3)};
  const spawnPools=makeSpawnPools(platforms,rng);
  return{
    roomSeed,
    grammar,
    label:GRAMMAR_LABELS[grammar],
    player:{x:544,y:560},
    floor,
    platforms,
    collision:[floor,...platforms],
    groundSpawns:spawnPools.ground,
    perchSpawns:spawnPools.perches,
  };
}

export function frameForTerrainMask(mask){
  const safe=Math.max(0,Math.min(15,Number(mask)||0));
  return PIXELLAB_FRAME_BY_MASK[safe];
}

export function parseEnvironmentSeed(value){
  if(value===null||value===undefined||value==='')return null;
  const parsed=Number.parseInt(String(value),10);
  return Number.isFinite(parsed)?(parsed>>>0):null;
}

function seedOverrideFromLocation(){
  try{
    const search=globalThis?.location?.search||'';
    return parseEnvironmentSeed(new URLSearchParams(search).get('seed'));
  }catch(_){return null;}
}

export class GameSceneV22 extends GameSceneV21 {
  preload(){
    super.preload();
    this.load.spritesheet(GOTHIC_TILESET_KEY,GOTHIC_TILESET_PATH,{frameWidth:GOTHIC_TILE_SIZE,frameHeight:GOTHIC_TILE_SIZE});
  }

  create(){
    this.environmentTerrainSprites=[];
    this.environmentLayout=null;
    this.environmentDebugText=null;
    super.create();

    const forcedSeed=seedOverrideFromLocation();
    if(forcedSeed!==null&&forcedSeed!==this.runSeed){
      this.runSeed=forcedSeed;
      const template=this.runHistory?.[this.runGraphDepth]||{id:'duel',name:'DUEL'};
      this.rebuildRoomLayout(template);
      this.updateHud();
    }

    this.environmentDebugText=this.add.text(18,this.scale.height-18,'',{
      fontFamily:'monospace',fontSize:'10px',color:'#93a0b7',backgroundColor:'#070910aa',padding:{x:6,y:4}
    }).setOrigin(0,1).setScrollFactor(0).setDepth(904).setAlpha(.72);
    this.scale.on('resize',size=>this.environmentDebugText?.setPosition(18,size.height-18));
    this.updateEnvironmentDebugText();
  }

  clearEnvironmentGeometry(){
    for(const sprite of this.environmentTerrainSprites||[])sprite?.destroy?.();
    this.environmentTerrainSprites=[];

    for(const item of this.dynamicRoomDecor||[])item?.destroy?.();
    this.dynamicRoomDecor=[];

    const children=[...(this.platforms?.getChildren?.()||[])];
    for(const child of children){
      try{this.platforms?.remove?.(child);}catch(_){}
      child?.destroy?.();
    }
    this.dynamicRoomPlatforms=[];
  }

  addEnvironmentCollider(spec){
    const collider=this.add.rectangle(spec.x+spec.w/2,spec.y+spec.h/2,spec.w,spec.h,0x000000,0)
      .setDepth(-5)
      .setVisible(false);
    this.physics.add.existing(collider,true);
    this.platforms.add(collider);
    this.dynamicRoomPlatforms.push(collider);
    return collider;
  }

  occupancyFor(specs){
    const occupied=new Set();
    for(const spec of specs){
      const x0=Math.round(spec.x/GOTHIC_TILE_SIZE);
      const y0=Math.round(spec.y/GOTHIC_TILE_SIZE);
      const cols=Math.max(1,Math.round(spec.w/GOTHIC_TILE_SIZE));
      const rows=Math.max(1,Math.round(spec.h/GOTHIC_TILE_SIZE));
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)occupied.add(`${x0+x},${y0+y}`);
    }
    return occupied;
  }

  renderGothicTerrain(specs){
    const occupied=this.occupancyFor(specs);
    if(!occupied.size)return;
    const coords=[...occupied].map(key=>key.split(',').map(Number));
    const xs=coords.map(([x])=>x),ys=coords.map(([,y])=>y);
    const minX=Math.min(...xs),maxX=Math.max(...xs)+1;
    const minY=Math.min(...ys),maxY=Math.max(...ys)+1;
    const has=(x,y)=>occupied.has(`${x},${y}`);

    for(let vy=minY;vy<=maxY;vy++){
      for(let vx=minX;vx<=maxX;vx++){
        // PixelLab encodes upper/background as bit 1 and lower/platform as 0.
        const mask=(has(vx-1,vy-1)?0:8)|
          (has(vx,vy-1)?0:4)|
          (has(vx-1,vy)?0:2)|
          (has(vx,vy)?0:1);
        if(mask===15)continue;
        const tile=this.add.image(vx*GOTHIC_TILE_SIZE,vy*GOTHIC_TILE_SIZE,GOTHIC_TILESET_KEY,frameForTerrainMask(mask))
          .setOrigin(.5)
          .setDepth(6);
        this.environmentTerrainSprites.push(tile);
      }
    }
  }

  snapAuthoredPlatform(spec){
    return{
      x:snap(spec.x),
      y:snap(spec.y),
      w:Math.max(GOTHIC_TILE_SIZE,snap(spec.w)),
      h:GOTHIC_TILE_SIZE,
    };
  }

  authoredBossEnvironment(template){
    const authored=this.roomLayoutFor(template);
    const floor={x:ARENA_GRID_LEFT,y:ARENA_FLOOR_Y,w:ARENA_GRID_RIGHT-ARENA_GRID_LEFT,h:cells(3)};
    const platforms=(authored.platforms||[]).map(spec=>this.snapAuthoredPlatform(spec));
    return{
      roomSeed:mixSeed(this.runSeed||1,this.runGraphDepth||0,'boss1'),
      grammar:'boss',label:GRAMMAR_LABELS.boss,player:authored.player||{x:560,y:560},
      floor,platforms,collision:[floor,...platforms],
      groundSpawns:(authored.spawns||[]).map(({x,y})=>({x,y,minX:x-100,maxX:x+100,kind:'ground'})),
      perchSpawns:[],
    };
  }

  placeEnvironmentActors(layout){
    const room=this.rooms?.[0];
    const enemies=room?.enemies||[];
    const grounds=[...layout.groundSpawns];
    const perches=[...layout.perchSpawns];

    enemies.forEach((enemy,index)=>{
      let spawn;
      if(enemy.type==='enemy2')spawn=perches.shift()||grounds.shift()||perches[0]||grounds[0];
      else spawn=grounds.shift()||perches.shift()||grounds[0]||perches[0];
      if(!spawn)spawn={x:960+index*180,y:560,minX:860,maxX:1540};

      enemy.sprite?.setDepth?.(20);
      enemy.sprite?.setPosition?.(spawn.x,spawn.y);
      enemy.sprite?.body?.reset?.(spawn.x,spawn.y);
      enemy.sprite?.body?.setVelocity?.(0,0);
      enemy.tell?.setPosition?.(spawn.x,spawn.y-22);
      enemy.hpBarBg?.setPosition?.(spawn.x,spawn.y-122);
      enemy.hpBar?.setPosition?.(spawn.x-27,spawn.y-122);
      if(enemy.type==='enemy1'){
        enemy.patrolMin=spawn.minX??spawn.x-96;
        enemy.patrolMax=spawn.maxX??spawn.x+96;
      }
    });

    this.player?.setPosition?.(layout.player.x,layout.player.y);
    this.player?.body?.reset?.(layout.player.x,layout.player.y);
    this.player?.body?.setVelocity?.(0,0);
    this.pixelArt?.setPosition?.(layout.player.x,layout.player.y);
  }

  rebuildRoomLayout(template){
    this.clearEnvironmentGeometry();
    const isBoss=template?.id==='boss1';
    const layout=isBoss
      ?this.authoredBossEnvironment(template)
      :generateProceduralRoom(this.runSeed||1,this.runGraphDepth||0,template?.id||'duel');

    for(const spec of layout.collision)this.addEnvironmentCollider(spec);
    this.renderGothicTerrain(layout.collision);
    this.environmentLayout=layout;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
    this.cameras?.main?.shake?.(65,.0012);
  }

  loadRunNode(template,depth,transition=true){
    super.loadRunNode(template,depth,transition);
    this.updateEnvironmentDebugText();
    if(this.environmentLayout){
      this.showRoomBanner(`ROOM ${depth+1} • ${template.name} • ${this.environmentLayout.label}`,1200);
    }
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    this.environmentDebugText.setText(
      `SEED ${this.runSeed>>>0} • ROOM ${(this.runGraphDepth||0)+1} • ${this.environmentLayout.label}`
    );
  }
}
