import {
  GameSceneV22,
  GOTHIC_TILE_SIZE,
  ARENA_GRID_LEFT,
  ARENA_GRID_RIGHT,
  ARENA_FLOOR_Y,
} from './GameSceneV22.js';

export const LEVEL_DESIGN_V23=Object.freeze({
  maxBaselineRisePx:96,
  maxHorizontalJumpGapPx:160,
  oneWayColliderHeightPx:10,
  entrySafeUntilX:800,
  enemyMinPlayerDistancePx:288,
  minGroundSpawnSeparationPx:192,
  lowCeilingY:544,
});

const ARCHETYPE_LABELS=Object.freeze({
  duelRun:'DUELING RUN',
  stairLoop:'ASCENT LOOP',
  splitRoute:'SPLIT ROUTE',
  perchRun:'HUNTER PERCHES',
  zigzag:'ZIGZAG CHASE',
  fallenGallery:'FALLEN GALLERY',
  gauntlet:'GAUNTLET CLIMB',
});

const TEMPLATE_ARCHETYPES=Object.freeze({
  duel:['duelRun','stairLoop'],
  hunters:['stairLoop','zigzag','duelRun'],
  mixed:['splitRoute','stairLoop','perchRun','zigzag'],
  crossfire:['perchRun','splitRoute'],
  pressure:['zigzag','stairLoop','splitRoute'],
  barrage:['perchRun','splitRoute','fallenGallery'],
  elite:['gauntlet'],
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
function platform(x,y,widthCells,role='route'){
  return{x:snap(x),y:snap(y),w:cells(widthCells),h:GOTHIC_TILE_SIZE,role};
}

function jitterPlatforms(base,rng){
  return base.map((spec,index)=>{
    const xJitter=index===0?0:cells(randInt(rng,-1,1));
    const widthJitter=randInt(rng,-1,1);
    return{
      ...spec,
      x:snap(spec.x+xJitter),
      w:cells(Math.max(5,Math.min(8,Math.round(spec.w/GOTHIC_TILE_SIZE)+widthJitter))),
    };
  });
}

function basePlatforms(archetype){
  switch(archetype){
    case'duelRun':return[
      platform(704,544,6),
      platform(992,480,7),
      platform(1344,544,6),
    ];
    case'stairLoop':return[
      platform(672,544,6),
      platform(896,480,6),
      platform(1120,416,7),
      platform(1408,480,6),
    ];
    case'splitRoute':return[
      platform(704,544,7),
      platform(992,480,6),
      platform(1248,544,7),
      platform(1056,384,6,'bonus'),
    ];
    case'perchRun':return[
      platform(704,544,6),
      platform(960,512,8),
      platform(1280,544,6),
      platform(960,416,6,'bonus'),
      platform(1312,448,5,'bonus'),
    ];
    case'zigzag':return[
      platform(672,544,6),
      platform(896,480,6),
      platform(1120,544,6),
      platform(1344,480,6),
    ];
    case'gauntlet':return[
      platform(672,544,6),
      platform(896,480,6),
      platform(1120,416,6),
      platform(1344,480,6),
      platform(1472,384,5,'bonus'),
    ];
    default:return[
      platform(704,544,8),
      platform(1056,480,7),
      platform(1376,544,7),
      platform(1152,384,6,'bonus'),
    ];
  }
}

function clampPlatform(spec){
  const minX=ARENA_GRID_LEFT+cells(5);
  const maxRight=ARENA_GRID_RIGHT-cells(2);
  const width=Math.max(cells(5),Math.min(cells(8),spec.w));
  const x=Math.max(minX,Math.min(spec.x,maxRight-width));
  const y=Math.max(384,Math.min(544,spec.y));
  return{...spec,x:snap(x),y:snap(y),w:width,h:GOTHIC_TILE_SIZE};
}

function repairMainRoute(platforms){
  const route=platforms.filter(spec=>spec.role!=='bonus');
  for(let i=0;i<route.length;i++){
    const current=route[i];
    if(i===0){
      current.y=Math.max(ARENA_FLOOR_Y-LEVEL_DESIGN_V23.maxBaselineRisePx,current.y);
      current.x=Math.min(current.x,736);
      continue;
    }
    const previous=route[i-1];
    const rise=previous.y-current.y;
    if(rise>LEVEL_DESIGN_V23.maxBaselineRisePx)current.y=snap(previous.y-LEVEL_DESIGN_V23.maxBaselineRisePx);
    const maxLeft=previous.x+previous.w+LEVEL_DESIGN_V23.maxHorizontalJumpGapPx;
    if(current.x>maxLeft)current.x=snap(maxLeft);
  }
  return platforms;
}

function horizontalGap(a,b){
  const aRight=a.x+a.w,bRight=b.x+b.w;
  if(aRight<b.x)return b.x-aRight;
  if(bRight<a.x)return a.x-bRight;
  return 0;
}

function canReachSurface(from,to){
  const rise=from.y-to.y;
  if(rise>LEVEL_DESIGN_V23.maxBaselineRisePx)return false;
  return horizontalGap(from,to)<=LEVEL_DESIGN_V23.maxHorizontalJumpGapPx;
}

export function reachablePlatformCount(room){
  const floor={...room.floor,role:'floor'};
  const surfaces=[floor,...room.platforms];
  const reached=new Set([0]);
  let changed=true;
  while(changed){
    changed=false;
    for(let from=0;from<surfaces.length;from++){
      if(!reached.has(from))continue;
      for(let to=1;to<surfaces.length;to++){
        if(reached.has(to))continue;
        if(canReachSurface(surfaces[from],surfaces[to])){
          reached.add(to);changed=true;
        }
      }
    }
  }
  return reached.size-1;
}

export function roomHasBaselineTraversal(room){
  return reachablePlatformCount(room)===room.platforms.length;
}

function underLowCeiling(x,platforms){
  return platforms.some(spec=>spec.y>=LEVEL_DESIGN_V23.lowCeilingY&&x>=spec.x-32&&x<=spec.x+spec.w+32);
}

function selectSeparatedGroundSpawns(platforms,playerX){
  const candidates=[832,928,1024,1120,1216,1312,1408,1504,1600,1664]
    .filter(x=>x>=LEVEL_DESIGN_V23.entrySafeUntilX)
    .filter(x=>Math.abs(x-playerX)>=LEVEL_DESIGN_V23.enemyMinPlayerDistancePx)
    .filter(x=>!underLowCeiling(x,platforms));
  const selected=[];
  for(const x of candidates){
    if(selected.every(spawn=>Math.abs(spawn.x-x)>=LEVEL_DESIGN_V23.minGroundSpawnSeparationPx)){
      selected.push({x:snap(x),y:560,minX:snap(x-96),maxX:snap(x+96),kind:'ground'});
    }
  }
  if(selected.length<3){
    for(const x of [960,1248,1568]){
      if(selected.every(spawn=>Math.abs(spawn.x-x)>=160))selected.push({x:snap(x),y:560,minX:snap(x-80),maxX:snap(x+80),kind:'ground'});
    }
  }
  return selected.slice(0,5);
}

function makePerchSpawns(platforms){
  return platforms
    .filter(spec=>spec.y<=512&&spec.w>=cells(5))
    .sort((a,b)=>a.y-b.y||a.x-b.x)
    .map(spec=>({
      x:snap(spec.x+spec.w/2),
      y:spec.y-44,
      minX:spec.x+32,
      maxX:spec.x+spec.w-32,
      kind:'perch',
    }));
}

function chooseArchetype(seed,depth,templateId){
  const pool=TEMPLATE_ARCHETYPES[templateId]||['stairLoop','splitRoute','zigzag','fallenGallery'];
  const mixed=hashSeed(seed,depth,templateId);
  return pool[(mixed+depth)%pool.length];
}

export function generatePlayableRoomV23(seed,depth=0,templateId='duel'){
  const roomSeed=hashSeed(seed,depth,`v23:${templateId}`);
  const rng=mulberry32(roomSeed);
  const archetype=chooseArchetype(seed,depth,templateId);
  let platforms=jitterPlatforms(basePlatforms(archetype),rng).map(clampPlatform);
  platforms=repairMainRoute(platforms);

  // Keep bonus platforms attached to a reachable route surface. They add a
  // tempting high lane without ever being required for basic room traversal.
  for(const bonus of platforms.filter(spec=>spec.role==='bonus')){
    const route=platforms.filter(spec=>spec.role!=='bonus');
    let parent=route.reduce((best,spec)=>horizontalGap(spec,bonus)<horizontalGap(best,bonus)?spec:best,route[0]);
    if(parent.y-bonus.y>LEVEL_DESIGN_V23.maxBaselineRisePx)bonus.y=snap(parent.y-LEVEL_DESIGN_V23.maxBaselineRisePx);
    if(horizontalGap(parent,bonus)>LEVEL_DESIGN_V23.maxHorizontalJumpGapPx)bonus.x=snap(parent.x+Math.min(parent.w,64));
  }

  const floor={x:ARENA_GRID_LEFT,y:ARENA_FLOOR_Y,w:ARENA_GRID_RIGHT-ARENA_GRID_LEFT,h:cells(3),role:'floor'};
  const player={x:544,y:560};
  const groundSpawns=selectSeparatedGroundSpawns(platforms,player.x);
  const perchSpawns=makePerchSpawns(platforms);
  const room={
    roomSeed,
    grammar:archetype,
    label:ARCHETYPE_LABELS[archetype],
    player,
    floor,
    platforms,
    collision:[floor,...platforms],
    groundSpawns,
    perchSpawns,
  };

  // Defensive fallback: generation should satisfy this naturally, but a bad
  // future grammar must fail safe into a simple playable room rather than ship
  // an unreachable platform arrangement.
  if(!roomHasBaselineTraversal(room)){
    room.platforms=[platform(704,544,7),platform(992,480,7),platform(1312,544,7)];
    room.collision=[floor,...room.platforms];
    room.groundSpawns=selectSeparatedGroundSpawns(room.platforms,player.x);
    room.perchSpawns=makePerchSpawns(room.platforms);
    room.grammar='duelRun';
    room.label=ARCHETYPE_LABELS.duelRun;
  }
  return room;
}

export class GameSceneV23 extends GameSceneV22 {
  configureOneWayPlatform(collider){
    const check=collider?.body?.checkCollision;
    if(!check)return collider;
    check.up=true;
    check.down=false;
    check.left=false;
    check.right=false;
    return collider;
  }

  addTraversalCollider(spec){
    const collisionSpec={...spec,h:LEVEL_DESIGN_V23.oneWayColliderHeightPx};
    return this.configureOneWayPlatform(this.addEnvironmentCollider(collisionSpec));
  }

  rebuildRoomLayout(template){
    if(template?.id==='boss1'){
      super.rebuildRoomLayout(template);
      return;
    }

    this.clearEnvironmentGeometry();
    const layout=generatePlayableRoomV23(this.runSeed||1,this.runGraphDepth||0,template?.id||'duel');

    this.addEnvironmentCollider(layout.floor);
    for(const spec of layout.platforms)this.addTraversalCollider(spec);
    this.renderGothicTerrain([layout.floor,...layout.platforms]);

    this.environmentLayout=layout;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
    this.cameras?.main?.shake?.(55,.001);
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    this.environmentDebugText.setText(
      `SEED ${this.runSeed>>>0} • ROOM ${(this.runGraphDepth||0)+1} • ${this.environmentLayout.label} • FLOW OK`
    );
  }
}
