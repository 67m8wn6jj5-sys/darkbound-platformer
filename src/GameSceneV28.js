import { GameSceneV27 } from './GameSceneV27.js';
import {
  STAGE_FLOW_V24,
  activationZoneForX,
} from './GameSceneV24.js';
import {
  GOTHIC_TILE_SIZE,
  ARENA_FLOOR_Y,
} from './GameSceneV22.js';

const CHUNK_WIDTH=768;
const CHUNK_BASES=Object.freeze([STAGE_FLOW_V24.left,STAGE_FLOW_V24.left+CHUNK_WIDTH,STAGE_FLOW_V24.left+CHUNK_WIDTH*2]);
const GATE_TOP=348;
const GATE_BOTTOM=640;
const GATE_HEIGHT=GATE_BOTTOM-GATE_TOP;

const WORLDGEN_V28=Object.freeze({
  maxRisePx:96,
  maxGapPx:160,
  pitMinPx:64,
  pitMaxPx:128,
  minFloorSegmentPx:160,
});

const CHUNK_LIBRARY=Object.freeze({
  entrance:Object.freeze([
    Object.freeze({
      id:'collapsedNave',label:'COLLAPSED NAVE',gap:Object.freeze([416,512]),
      platforms:Object.freeze([
        Object.freeze([128,544,6,'route']),
        Object.freeze([352,480,6,'route']),
        Object.freeze([576,544,5,'route']),
        Object.freeze([384,384,5,'bonus']),
      ]),
      decor:'arches',
    }),
    Object.freeze({
      id:'cryptStair',label:'CRYPT STAIR',gap:Object.freeze([544,640]),
      platforms:Object.freeze([
        Object.freeze([128,544,6,'route']),
        Object.freeze([320,480,6,'route']),
        Object.freeze([512,416,6,'route']),
        Object.freeze([640,480,4,'route']),
      ]),
      decor:'chains',
    }),
    Object.freeze({
      id:'brokenCauseway',label:'BROKEN CAUSEWAY',gap:Object.freeze([288,384]),
      platforms:Object.freeze([
        Object.freeze([96,544,6,'route']),
        Object.freeze([320,480,6,'route']),
        Object.freeze([544,544,6,'route']),
        Object.freeze([576,448,5,'bonus']),
      ]),
      decor:'pillars',
    }),
  ]),
  middle:Object.freeze([
    Object.freeze({
      id:'splitGallery',label:'SPLIT GALLERY',gap:Object.freeze([352,448]),
      platforms:Object.freeze([
        Object.freeze([96,544,6,'route']),
        Object.freeze([288,480,6,'route']),
        Object.freeze([480,416,6,'route']),
        Object.freeze([640,480,4,'route']),
        Object.freeze([224,384,5,'bonus']),
      ]),
      decor:'arches',
    }),
    Object.freeze({
      id:'watcherLoft',label:'WATCHER LOFT',gap:Object.freeze([512,608]),
      platforms:Object.freeze([
        Object.freeze([96,544,7,'route']),
        Object.freeze([352,480,7,'route']),
        Object.freeze([608,544,5,'route']),
        Object.freeze([352,352,6,'bonus']),
      ]),
      decor:'chains',
    }),
    Object.freeze({
      id:'sunkenCrypt',label:'SUNKEN CRYPT',gap:Object.freeze([224,320]),
      platforms:Object.freeze([
        Object.freeze([96,544,5,'route']),
        Object.freeze([288,480,6,'route']),
        Object.freeze([512,544,7,'route']),
        Object.freeze([544,416,5,'bonus']),
      ]),
      decor:'pillars',
    }),
  ]),
  exit:Object.freeze([
    Object.freeze({
      id:'ruinedChoir',label:'RUINED CHOIR',gap:Object.freeze([448,544]),
      platforms:Object.freeze([
        Object.freeze([96,544,6,'route']),
        Object.freeze([288,480,6,'route']),
        Object.freeze([512,416,6,'route']),
        Object.freeze([640,480,4,'route']),
      ]),
      decor:'arches',
    }),
    Object.freeze({
      id:'executionHall',label:'EXECUTION HALL',gap:Object.freeze([288,384]),
      platforms:Object.freeze([
        Object.freeze([96,544,6,'route']),
        Object.freeze([320,480,7,'route']),
        Object.freeze([576,544,5,'route']),
        Object.freeze([352,384,6,'bonus']),
      ]),
      decor:'chains',
    }),
    Object.freeze({
      id:'brokenAscent',label:'BROKEN ASCENT',gap:Object.freeze([544,640]),
      platforms:Object.freeze([
        Object.freeze([96,544,5,'route']),
        Object.freeze([256,480,6,'route']),
        Object.freeze([448,416,6,'route']),
        Object.freeze([640,480,4,'route']),
        Object.freeze([256,384,5,'bonus']),
      ]),
      decor:'pillars',
    }),
  ]),
});

const TEMPLATE_CHUNK_BIAS=Object.freeze({
  duel:Object.freeze([0,0,0]),
  hunters:Object.freeze([2,1,0]),
  mixed:Object.freeze([0,1,2]),
  crossfire:Object.freeze([1,1,1]),
  pressure:Object.freeze([2,0,2]),
  barrage:Object.freeze([0,2,1]),
  elite:Object.freeze([2,1,2]),
});

function hashSeed(seed,depth,text=''){
  let h=((Number(seed)||1)>>>0)^Math.imul((depth+1)>>>0,0x9e3779b1);
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,0x01000193);
  }
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
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
function snap(value){return Math.round(value/GOTHIC_TILE_SIZE)*GOTHIC_TILE_SIZE;}
function cells(count){return count*GOTHIC_TILE_SIZE;}

function horizontalGap(a,b){
  const aRight=a.x+a.w;
  const bRight=b.x+b.w;
  if(aRight<b.x)return b.x-aRight;
  if(bRight<a.x)return a.x-bRight;
  return 0;
}

function canReachSurface(from,to){
  const rise=from.y-to.y;
  if(rise>WORLDGEN_V28.maxRisePx)return false;
  return horizontalGap(from,to)<=WORLDGEN_V28.maxGapPx;
}

function routeIsPlayable(room){
  const surfaces=[...room.floorSegments,...room.platforms];
  if(!surfaces.length)return false;
  const startIndex=surfaces.findIndex(spec=>room.player.x>=spec.x&&room.player.x<=spec.x+spec.w&&spec.y===ARENA_FLOOR_Y);
  if(startIndex<0)return false;
  const reached=new Set([startIndex]);
  let changed=true;
  while(changed){
    changed=false;
    for(let from=0;from<surfaces.length;from++){
      if(!reached.has(from))continue;
      for(let to=0;to<surfaces.length;to++){
        if(reached.has(to))continue;
        if(canReachSurface(surfaces[from],surfaces[to])){
          reached.add(to);
          changed=true;
        }
      }
    }
  }
  const finish=surfaces.findIndex(spec=>spec.y===ARENA_FLOOR_Y&&spec.x+spec.w>=STAGE_FLOW_V24.right-96);
  return finish>=0&&reached.has(finish)&&room.platforms.every(spec=>spec.role==='bonus'||reached.has(surfaces.indexOf(spec)));
}

function chooseChunks(seed,depth,templateId){
  const rng=mulberry32(hashSeed(seed,depth,`v28:${templateId}`));
  const bias=TEMPLATE_CHUNK_BIAS[templateId]||[0,1,2];
  const groups=['entrance','middle','exit'];
  return groups.map((group,index)=>{
    const pool=CHUNK_LIBRARY[group];
    const offset=randInt(rng,0,pool.length-1);
    return pool[(bias[index]+offset)%pool.length];
  });
}

function platformFromLocal(base,spec,rng){
  const [localX,y,widthCells,role='route']=spec;
  const jitter=role==='bonus'?cells(randInt(rng,-1,1)):0;
  return{
    x:snap(base+localX+jitter),
    y:snap(y),
    w:cells(widthCells),
    h:GOTHIC_TILE_SIZE,
    role,
  };
}

function floorSegmentsForChunk(base,chunk,rng){
  const [gapStartRaw,gapEndRaw]=chunk.gap;
  const delta=cells(randInt(rng,-1,1));
  let gapStart=snap(base+gapStartRaw+delta);
  let gapEnd=snap(base+gapEndRaw+delta);
  gapStart=Math.max(base+WORLDGEN_V28.minFloorSegmentPx,Math.min(gapStart,base+CHUNK_WIDTH-WORLDGEN_V28.minFloorSegmentPx-WORLDGEN_V28.pitMinPx));
  gapEnd=Math.max(gapStart+WORLDGEN_V28.pitMinPx,Math.min(gapEnd,base+CHUNK_WIDTH-WORLDGEN_V28.minFloorSegmentPx));
  if(gapEnd-gapStart>WORLDGEN_V28.pitMaxPx)gapEnd=gapStart+WORLDGEN_V28.pitMaxPx;
  return[
    {x:base,y:ARENA_FLOOR_Y,w:gapStart-base,h:cells(3),role:'floor'},
    {x:gapEnd,y:ARENA_FLOOR_Y,w:base+CHUNK_WIDTH-gapEnd,h:cells(3),role:'floor'},
  ].filter(spec=>spec.w>=GOTHIC_TILE_SIZE);
}

function floorContainsX(floorSegments,x,margin=32){
  return floorSegments.some(spec=>x>=spec.x+margin&&x<=spec.x+spec.w-margin);
}

function groundSpawnsForWorld(floorSegments){
  const candidates=[
    672,800,960,
    1184,1344,1536,1696,
    1952,2112,2272,2432,
  ];
  const valid=candidates.filter(x=>floorContainsX(floorSegments,x,48));
  const buckets=[[],[],[]];
  for(const x of valid)buckets[activationZoneForX(x)].push(x);
  const spread=[];
  while(buckets.some(bucket=>bucket.length)){
    for(const bucket of buckets){
      const x=bucket.shift();
      if(x!==undefined)spread.push({x:snap(x),y:560,minX:snap(x-96),maxX:snap(x+96),kind:'ground'});
    }
  }
  return spread;
}

function perchSpawnsForWorld(platforms){
  const buckets=[[],[],[]];
  for(const spec of platforms.filter(spec=>spec.y<=512&&spec.w>=cells(5))){
    const x=snap(spec.x+spec.w/2);
    buckets[activationZoneForX(x)].push({
      x,y:spec.y-44,minX:spec.x+32,maxX:spec.x+spec.w-32,kind:'perch',
    });
  }
  const spread=[];
  while(buckets.some(bucket=>bucket.length)){
    for(const bucket of buckets){
      const spawn=bucket.shift();
      if(spawn)spread.push(spawn);
    }
  }
  return spread;
}

function safeFallbackWorld(seed,depth,templateId){
  const floorSegments=[
    {x:STAGE_FLOW_V24.left,y:ARENA_FLOOR_Y,w:640,h:cells(3),role:'floor'},
    {x:1024,y:ARENA_FLOOR_Y,w:672,h:cells(3),role:'floor'},
    {x:1792,y:ARENA_FLOOR_Y,w:768,h:cells(3),role:'floor'},
  ];
  const platforms=[
    {x:736,y:544,w:192,h:32,role:'route'},
    {x:928,y:480,w:192,h:32,role:'route'},
    {x:1120,y:544,w:192,h:32,role:'route'},
    {x:1536,y:544,w:192,h:32,role:'route'},
    {x:1728,y:480,w:192,h:32,role:'route'},
    {x:1920,y:544,w:192,h:32,role:'route'},
  ];
  return{
    roomSeed:hashSeed(seed,depth,`v28-fallback:${templateId}`),
    grammar:'modularFallback',
    label:'BROKEN CATHEDRAL',
    chunks:[],
    player:{x:STAGE_FLOW_V24.playerStartX,y:560},
    floor:{x:STAGE_FLOW_V24.left,y:ARENA_FLOOR_Y,w:STAGE_FLOW_V24.right-STAGE_FLOW_V24.left,h:cells(3),role:'floor'},
    floorSegments,
    platforms,
    collision:[...floorSegments,...platforms],
    groundSpawns:groundSpawnsForWorld(floorSegments),
    perchSpawns:perchSpawnsForWorld(platforms),
  };
}

export function generateModularStageV28(seed,depth=0,templateId='duel'){
  const roomSeed=hashSeed(seed,depth,`v28:${templateId}`);
  const rng=mulberry32(roomSeed);
  const chunks=chooseChunks(seed,depth,templateId);
  const floorSegments=[];
  const platforms=[];
  chunks.forEach((chunk,index)=>{
    const base=CHUNK_BASES[index];
    floorSegments.push(...floorSegmentsForChunk(base,chunk,rng));
    for(const spec of chunk.platforms)platforms.push(platformFromLocal(base,spec,rng));
  });
  const room={
    roomSeed,
    grammar:'modularChunks',
    label:chunks.map(chunk=>chunk.label).join(' • '),
    chunks:chunks.map((chunk,index)=>({...chunk,base:CHUNK_BASES[index]})),
    player:{x:STAGE_FLOW_V24.playerStartX,y:560},
    floor:{x:STAGE_FLOW_V24.left,y:ARENA_FLOOR_Y,w:STAGE_FLOW_V24.right-STAGE_FLOW_V24.left,h:cells(3),role:'floor'},
    floorSegments,
    platforms,
    collision:[...floorSegments,...platforms],
    groundSpawns:groundSpawnsForWorld(floorSegments),
    perchSpawns:perchSpawnsForWorld(platforms),
  };
  return routeIsPlayable(room)?room:safeFallbackWorld(seed,depth,templateId);
}

export class GameSceneV28 extends GameSceneV27 {
  clearV28Gates(){
    for(const gate of this.progressionGates?.values?.()||[]){
      gate?.blocker?.destroy?.();
      gate?.destroy?.();
    }
    this.progressionGates=new Map();
  }

  createProgressionGate(x){
    const container=this.add.container(x,GATE_TOP).setDepth(80);
    const stone=0x252733;
    const stoneEdge=0x555b6f;
    const iron=0x17191f;
    const ironEdge=0x5d6370;

    const leftPillar=this.add.rectangle(-25,GATE_HEIGHT*.5,18,GATE_HEIGHT+40,stone,1).setStrokeStyle(2,stoneEdge,.9);
    const rightPillar=this.add.rectangle(25,GATE_HEIGHT*.5,18,GATE_HEIGHT+40,stone,1).setStrokeStyle(2,stoneEdge,.9);
    const lintel=this.add.rectangle(0,-8,70,24,stone,1).setStrokeStyle(2,stoneEdge,.9);
    const capLeft=this.add.rectangle(-25,14,28,14,0x343745,1);
    const capRight=this.add.rectangle(25,14,28,14,0x343745,1);
    const barAssembly=this.add.container(0,0);
    for(let bx=-18;bx<=18;bx+=9){
      barAssembly.add(this.add.rectangle(bx,GATE_HEIGHT*.5,5,GATE_HEIGHT,iron,1).setStrokeStyle(1,ironEdge,.7));
    }
    for(let by=52;by<GATE_HEIGHT;by+=58){
      barAssembly.add(this.add.rectangle(0,by,48,5,iron,1).setStrokeStyle(1,ironEdge,.6));
    }
    for(const sx of [-18,-9,0,9,18]){
      barAssembly.add(this.add.triangle(sx,GATE_HEIGHT+8,-4,-12,4,-12,0,4,iron,1));
    }
    container.add([leftPillar,rightPillar,lintel,capLeft,capRight,barAssembly]);
    container.barAssembly=barAssembly;
    container.locked=false;

    const blocker=this.add.rectangle(x,GATE_TOP+GATE_HEIGHT*.5,34,GATE_HEIGHT,0x000000,0).setVisible(false);
    this.physics.add.existing(blocker,true);
    this.physics.add.collider(this.player,blocker);
    for(const enemy of this.enemies||[])this.physics.add.collider(enemy.sprite,blocker);
    container.blocker=blocker;
    return container;
  }

  setGateLocked(x,locked){
    const gate=this.progressionGates?.get?.(x);
    if(!gate||gate.locked===locked)return;
    gate.locked=locked;
    if(gate.blocker?.body)gate.blocker.body.enable=locked;
    const bars=gate.barAssembly;
    if(!bars)return;
    this.tweens.killTweensOf(bars);
    if(locked){
      bars.setY(-GATE_HEIGHT*.88).setAlpha(.95);
      this.tweens.add({
        targets:bars,y:0,alpha:1,duration:220,ease:'Cubic.easeIn',
        onComplete:()=>this.cameras?.main?.shake?.(65,.0024),
      });
    }else{
      this.tweens.add({targets:bars,y:-GATE_HEIGHT*.88,alpha:.84,duration:300,ease:'Cubic.easeOut'});
    }
  }

  replaceStageGatesV24(isBoss=false){
    this.clearV28Gates();
    this.v24ZoneGateStates=new Map();
    this.v24ZoneGateXs=[];
    this.v24OuterGateXs=isBoss?[430,1710]:[STAGE_FLOW_V24.left,STAGE_FLOW_V24.right];
    for(const x of this.v24OuterGateXs)this.progressionGates.set(x,this.createProgressionGate(x));
    for(const x of this.v24OuterGateXs)this.setGateLocked(x,true);
  }

  setStageZoneGateLockedV24(){ }
  updateStageZoneGatesV24(){ }

  clearEnvironmentGeometry(){
    super.clearEnvironmentGeometry();
    this.v28Decor=[];
  }

  addV28Decor(item){
    this.dynamicRoomDecor=this.dynamicRoomDecor||[];
    this.dynamicRoomDecor.push(item);
    this.v28Decor=this.v28Decor||[];
    this.v28Decor.push(item);
    return item;
  }

  createBackgroundArch(x,width=250,height=230){
    const g=this.add.graphics().setDepth(2).setAlpha(.42);
    g.lineStyle(14,0x252938,.92);
    g.beginPath();
    g.moveTo(x-width*.5,620);
    g.lineTo(x-width*.5,480);
    g.arc(x,480,width*.5,Math.PI,0,false);
    g.lineTo(x+width*.5,620);
    g.strokePath();
    g.lineStyle(3,0x4a5065,.5);
    g.strokeCircle(x,480,width*.5-10);
    return this.addV28Decor(g);
  }

  createBrokenPillars(x){
    const g=this.add.graphics().setDepth(3).setAlpha(.68);
    g.fillStyle(0x2a2d3a,.95);
    g.fillRect(x-66,438,22,182);
    g.fillRect(x+54,488,22,132);
    g.fillStyle(0x3a3e4c,.9);
    g.fillRect(x-72,430,34,16);
    g.fillRect(x+48,480,34,16);
    g.lineStyle(2,0x596075,.45);
    g.beginPath();g.moveTo(x-64,460);g.lineTo(x-46,505);g.strokePath();
    return this.addV28Decor(g);
  }

  createHangingChains(x){
    const g=this.add.graphics().setDepth(4).setAlpha(.55);
    g.lineStyle(3,0x444956,.8);
    for(const offset of [-70,20,82]){
      g.beginPath();
      g.moveTo(x+offset,300);
      const length=95+Math.abs(offset)%50;
      for(let y=0;y<length;y+=12){
        g.lineTo(x+offset+(y%24===0?4:-4),300+y);
      }
      g.strokePath();
    }
    return this.addV28Decor(g);
  }

  createTorch(x,y=500){
    const stem=this.add.rectangle(x,y,5,34,0x5d4638,.95).setDepth(5);
    const flame=this.add.circle(x,y-20,5,0xffd166,.82).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    const glow=this.add.circle(x,y-20,18,0xff8a3d,.10).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(stem);this.addV28Decor(flame);this.addV28Decor(glow);
    this.tweens.add({targets:[flame,glow],scale:1.22,alpha:'+=0.06',yoyo:true,repeat:-1,duration:420+((x/32)%5)*45,ease:'Sine.easeInOut'});
  }

  dressModularWorldV28(layout){
    if(!layout?.chunks?.length)return;
    for(const chunk of layout.chunks){
      const center=chunk.base+CHUNK_WIDTH*.5;
      if(chunk.decor==='arches')this.createBackgroundArch(center,260,230);
      else if(chunk.decor==='chains')this.createHangingChains(center);
      else this.createBrokenPillars(center);
      this.createTorch(chunk.base+128,520);
      this.createTorch(chunk.base+CHUNK_WIDTH-128,520);
    }
    for(const spec of layout.platforms.filter(spec=>spec.role==='bonus')){
      const marker=this.add.rectangle(spec.x+spec.w*.5,spec.y-8,Math.min(52,spec.w*.35),3,0x6f765f,.35).setDepth(5);
      this.addV28Decor(marker);
    }
  }

  rebuildRoomLayout(template){
    if(template?.id==='boss1'){
      super.rebuildRoomLayout(template);
      return;
    }
    this.clearEnvironmentGeometry();
    const layout=generateModularStageV28(this.runSeed||1,this.runGraphDepth||0,template?.id||'duel');
    for(const spec of layout.floorSegments)this.addEnvironmentCollider(spec);
    for(const spec of layout.platforms)this.addTraversalCollider(spec);
    this.renderGothicTerrain(layout.collision);
    this.dressModularWorldV28(layout);
    this.environmentLayout=layout;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
    this.cameras?.main?.shake?.(55,.001);
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    const names=(this.environmentLayout.chunks||[]).map(chunk=>chunk.label).join(' / ');
    this.environmentDebugText.setText(
      `SEED ${this.runSeed>>>0} • ROOM ${(this.runGraphDepth||0)+1} • ${names||this.environmentLayout.label} • MODULAR FLOW`
    );
  }
}
