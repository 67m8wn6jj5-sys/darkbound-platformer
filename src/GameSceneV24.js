import {
  GameSceneV23,
  roomHasBaselineTraversal,
} from './GameSceneV23.js';
import {
  GOTHIC_TILE_SIZE,
  ARENA_FLOOR_Y,
} from './GameSceneV22.js';

export const STAGE_FLOW_V24=Object.freeze({
  left:256,
  right:2560,
  playerStartX:384,
  activationThresholds:Object.freeze([0,1088,1792]),
  stageZones:3,
  minPlatforms:6,
  minStageWidthPx:2200,
});

const STAGE_LABELS=Object.freeze({
  longRun:'LONG CRYPT RUN',
  splitAscent:'SPLIT ASCENT',
  perchGauntlet:'WATCHER GAUNTLET',
  zigzagHall:'BROKEN ZIGZAG',
  galleryRun:'FALLEN GALLERY RUN',
});

const TEMPLATE_STAGE_ARCHETYPES=Object.freeze({
  duel:['longRun','splitAscent'],
  hunters:['longRun','zigzagHall','splitAscent'],
  mixed:['splitAscent','perchGauntlet','zigzagHall'],
  crossfire:['perchGauntlet','splitAscent'],
  pressure:['zigzagHall','splitAscent','galleryRun'],
  barrage:['perchGauntlet','galleryRun','zigzagHall'],
  elite:['zigzagHall','perchGauntlet'],
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

function baseStagePlatforms(archetype){
  switch(archetype){
    case'splitAscent':return[
      platform(512,544,7),
      platform(768,480,7),
      platform(1024,416,7),
      platform(1312,480,7),
      platform(1600,416,7),
      platform(1888,480,7),
      platform(2176,544,7),
      platform(1344,352,6,'bonus'),
    ];
    case'perchGauntlet':return[
      platform(544,544,8),
      platform(896,512,8),
      platform(1248,544,8),
      platform(1600,512,8),
      platform(1952,544,8),
      platform(2240,480,6),
      platform(896,416,6,'bonus'),
      platform(1472,384,6,'bonus'),
      platform(2016,416,6,'bonus'),
    ];
    case'zigzagHall':return[
      platform(512,544,7),
      platform(800,480,7),
      platform(1088,544,7),
      platform(1376,480,7),
      platform(1664,544,7),
      platform(1952,480,7),
      platform(2240,544,6),
    ];
    case'galleryRun':return[
      platform(512,544,8),
      platform(864,512,7),
      platform(1152,448,7),
      platform(1440,512,8),
      platform(1792,448,7),
      platform(2080,512,8),
      platform(2304,544,5),
      platform(1536,352,6,'bonus'),
    ];
    default:return[
      platform(512,544,8),
      platform(864,512,8),
      platform(1216,448,8),
      platform(1568,512,8),
      platform(1920,448,8),
      platform(2240,544,6),
    ];
  }
}

function chooseStageArchetype(seed,depth,templateId){
  const pool=TEMPLATE_STAGE_ARCHETYPES[templateId]||['longRun','splitAscent','zigzagHall','galleryRun'];
  return pool[hashSeed(seed,depth,templateId)%pool.length];
}

function jitterStagePlatforms(platforms,rng){
  return platforms.map((spec,index)=>{
    if(index===0)return{...spec};
    const jitterX=cells(randInt(rng,-1,1));
    const widthCells=Math.max(5,Math.min(8,Math.round(spec.w/GOTHIC_TILE_SIZE)+randInt(rng,-1,1)));
    return{...spec,x:snap(spec.x+jitterX),w:cells(widthCells)};
  });
}

function clampStagePlatform(spec){
  const minX=STAGE_FLOW_V24.left+cells(6);
  const maxRight=STAGE_FLOW_V24.right-cells(2);
  const width=Math.max(cells(5),Math.min(cells(8),spec.w));
  return{
    ...spec,
    x:snap(Math.max(minX,Math.min(spec.x,maxRight-width))),
    y:snap(Math.max(352,Math.min(544,spec.y))),
    w:width,
    h:GOTHIC_TILE_SIZE,
  };
}

export function activationZoneForX(x){
  if(x>=STAGE_FLOW_V24.activationThresholds[2])return 2;
  if(x>=STAGE_FLOW_V24.activationThresholds[1])return 1;
  return 0;
}

function groundSpawnsForStage(){
  // Interleave zones so even a three-enemy encounter occupies the beginning,
  // middle, and end of the expanded stage instead of clustering near entry.
  return[736,1280,1984,928,1536,2272,1024,1696,2432].map(x=>({
    x:snap(x),y:560,minX:snap(x-104),maxX:snap(x+104),kind:'ground'
  }));
}

function spreadAnchorsAcrossZones(anchors){
  const buckets=[[],[],[]];
  for(const anchor of anchors)buckets[activationZoneForX(anchor.x)].push(anchor);
  const spread=[];
  while(buckets.some(bucket=>bucket.length)){
    for(const bucket of buckets){
      const next=bucket.shift();
      if(next)spread.push(next);
    }
  }
  return spread;
}

function perchSpawnsForStage(platforms){
  const anchors=platforms
    .filter(spec=>spec.y<=512&&spec.w>=cells(5))
    .sort((a,b)=>a.x-b.x||a.y-b.y)
    .map(spec=>({
      x:snap(spec.x+spec.w/2),
      y:spec.y-44,
      minX:spec.x+32,
      maxX:spec.x+spec.w-32,
      kind:'perch',
    }));
  return spreadAnchorsAcrossZones(anchors);
}

export function generateExpandedStageV24(seed,depth=0,templateId='duel'){
  const roomSeed=hashSeed(seed,depth,`v24:${templateId}`);
  const rng=mulberry32(roomSeed);
  const grammar=chooseStageArchetype(seed,depth,templateId);
  const floor={
    x:STAGE_FLOW_V24.left,
    y:ARENA_FLOOR_Y,
    w:STAGE_FLOW_V24.right-STAGE_FLOW_V24.left,
    h:cells(3),
    role:'floor',
  };
  let platforms=jitterStagePlatforms(baseStagePlatforms(grammar),rng).map(clampStagePlatform);
  let room={
    roomSeed,
    grammar,
    label:STAGE_LABELS[grammar],
    player:{x:STAGE_FLOW_V24.playerStartX,y:560},
    floor,
    platforms,
    collision:[floor,...platforms],
    groundSpawns:groundSpawnsForStage(),
    perchSpawns:perchSpawnsForStage(platforms),
  };

  if(!roomHasBaselineTraversal(room)){
    platforms=baseStagePlatforms('longRun').map(clampStagePlatform);
    room={
      ...room,
      grammar:'longRun',
      label:STAGE_LABELS.longRun,
      platforms,
      collision:[floor,...platforms],
      perchSpawns:perchSpawnsForStage(platforms),
    };
  }
  return room;
}

const BASE_ROSTERS=Object.freeze({
  duel:Object.freeze(['enemy1','enemy1','enemy1']),
  hunters:Object.freeze(['enemy1','enemy1','enemy1','enemy1']),
  mixed:Object.freeze(['enemy1','enemy2','enemy1','enemy1']),
  crossfire:Object.freeze(['enemy2','enemy1','enemy2','enemy2']),
  pressure:Object.freeze(['enemy1','enemy1','enemy2','enemy1','enemy2']),
  barrage:Object.freeze(['enemy1','enemy2','enemy2','enemy1','enemy2']),
  elite:Object.freeze(['enemy1','enemy1','enemy2','enemy1','enemy2','enemy1']),
});

export function expandedEnemyRosterV24(templateId,depth=0){
  const roster=[...(BASE_ROSTERS[templateId]||BASE_ROSTERS.mixed)];
  if(depth>=2&&roster.length<6)roster.push(templateId==='crossfire'||templateId==='barrage'?'enemy2':'enemy1');
  if(depth>=3&&roster.length<6)roster.push('enemy2');
  return roster.slice(0,6);
}

export class GameSceneV24 extends GameSceneV23 {
  expandTemplateV24(template,depth){
    if(!template||template.id==='boss1')return template;
    return{
      ...template,
      enemies:expandedEnemyRosterV24(template.id,depth),
      subtitle:`${template.subtitle||template.name} • expanded stage`,
    };
  }

  setArenaLocked(locked){
    const xs=this.v24OuterGateXs?.length?this.v24OuterGateXs:[...(this.progressionGates?.keys?.()||[])];
    for(const x of xs)this.setGateLocked(x,locked);
    if(!locked){
      for(const x of this.v24ZoneGateXs||[])this.setStageZoneGateLockedV24(x,false);
    }
  }

  setStageZoneGateLockedV24(x,locked){
    this.v24ZoneGateStates=this.v24ZoneGateStates||new Map();
    if(this.v24ZoneGateStates.get(x)===locked)return;
    this.v24ZoneGateStates.set(x,locked);
    this.setGateLocked(x,locked);
  }

  replaceStageGatesV24(isBoss=false){
    for(const gate of this.progressionGates?.values?.()||[])gate?.destroy?.();
    this.progressionGates=new Map();
    this.v24ZoneGateStates=new Map();
    this.v24OuterGateXs=isBoss?[430,1710]:[STAGE_FLOW_V24.left,STAGE_FLOW_V24.right];
    this.v24ZoneGateXs=isBoss?[]:STAGE_FLOW_V24.activationThresholds.slice(1);
    for(const x of [...this.v24OuterGateXs,...this.v24ZoneGateXs]){
      this.progressionGates.set(x,this.createProgressionGate(x));
    }
    for(const x of this.v24OuterGateXs)this.setGateLocked(x,true);
    for(const x of this.v24ZoneGateXs)this.setStageZoneGateLockedV24(x,true);
  }

  rebuildRoomLayout(template){
    if(template?.id==='boss1'){
      super.rebuildRoomLayout(template);
      return;
    }

    this.clearEnvironmentGeometry();
    const layout=generateExpandedStageV24(this.runSeed||1,this.runGraphDepth||0,template?.id||'duel');
    this.addEnvironmentCollider(layout.floor);
    for(const spec of layout.platforms)this.addTraversalCollider(spec);
    this.renderGothicTerrain([layout.floor,...layout.platforms]);
    this.environmentLayout=layout;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
    this.cameras?.main?.shake?.(55,.001);
  }

  configureStageActivationV24(){
    const now=this.time?.now||0;
    const sorted=[...(this.enemies||[])].filter(enemy=>enemy?.alive&&enemy.type!=='boss1')
      .sort((a,b)=>(a.sprite?.x||0)-(b.sprite?.x||0));
    sorted.forEach((enemy,index)=>{
      const zone=activationZoneForX(enemy.sprite?.x||0);
      enemy.v24ActivationZone=zone;
      enemy.v24ActivationX=STAGE_FLOW_V24.activationThresholds[zone];
      enemy.v24StageIndex=index;
      if(zone===0){
        enemy.roomDormant=false;
        enemy.nextAttackAt=now+620+index*150;
      }else{
        this.setEnemyDormant(enemy,true);
        if(enemy.sprite?.body)enemy.sprite.body.enable=true;
      }
    });
    this.updateStageZoneGatesV24();
  }

  activateStageEnemyV24(enemy,time){
    if(!enemy?.roomDormant||!enemy.alive)return;
    this.setEnemyDormant(enemy,false);
    if(enemy.sprite?.body){
      enemy.sprite.body.enable=true;
      enemy.sprite.body.setVelocity(0,0);
    }
    enemy.nextAttackAt=time+520+(enemy.v24StageIndex||0)*90;
    if(enemy.type==='enemy2'){
      enemy.state='ranged';
      this.setTrollAnim(enemy,'patrol',time,true);
    }else{
      enemy.state='engage';
      this.setEnemyAnim(enemy,'patrol',time,true);
    }
    this.spawnGreenBurst?.(enemy.sprite.x,enemy.sprite.y-18,8,26,22,170);
  }

  updateStageZoneGatesV24(){
    if(!this.v24ZoneGateXs?.length)return;
    for(let zone=0;zone<this.v24ZoneGateXs.length;zone++){
      const blocking=(this.enemies||[]).some(enemy=>
        enemy?.alive&&enemy.type!=='boss1'&&enemy.v24ActivationZone===zone
      );
      this.setStageZoneGateLockedV24(this.v24ZoneGateXs[zone],blocking);
    }
  }

  updateStageActivationV24(time){
    if(this.dead||this.rewardActive||this.routeActive)return;
    const playerX=this.player?.x??STAGE_FLOW_V24.playerStartX;
    for(const enemy of this.enemies||[]){
      if(!enemy?.alive||!enemy.roomDormant||enemy.type==='boss1')continue;
      if(playerX>=enemy.v24ActivationX-32)this.activateStageEnemyV24(enemy,time);
    }
    this.updateStageZoneGatesV24();
  }

  loadRunNode(template,depth,transition=true){
    const expanded=this.expandTemplateV24(template,depth);
    super.loadRunNode(expanded,depth,transition);
    this.replaceStageGatesV24(expanded?.id==='boss1');
    if(expanded?.id!=='boss1'){
      this.configureStageActivationV24();
      if(this.environmentLayout){
        this.showRoomBanner(`ROOM ${depth+1} • ${expanded.name} • ${this.environmentLayout.label}`,1300);
      }
    }
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    const alive=this.enemies?.filter(enemy=>enemy?.alive&&enemy.type!=='boss1').length||0;
    this.environmentDebugText.setText(
      `SEED ${this.runSeed>>>0} • ROOM ${(this.runGraphDepth||0)+1} • ${this.environmentLayout.label} • ${alive} HOSTILES`
    );
  }

  update(time,delta){
    super.update(time,delta);
    this.updateStageActivationV24(time);
    this.updateEnvironmentDebugText();
  }
}
