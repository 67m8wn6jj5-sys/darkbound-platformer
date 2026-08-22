import { GameSceneV30 } from './GameSceneV30.js';
import { STAGE_FLOW_V24 } from './GameSceneV24.js';
import { GOTHIC_TILE_SIZE, ARENA_FLOOR_Y } from './GameSceneV22.js';

const BACKGROUND_BASES=Object.freeze([256,1024,1792]);

function cells(count){return count*GOTHIC_TILE_SIZE;}
function platform(x,y,widthCells,role='route'){
  return Object.freeze({x,y,w:cells(widthCells),h:GOTHIC_TILE_SIZE,role});
}

export const AUTHORED_STAGE_V31=Object.freeze({
  grandNave:Object.freeze({
    label:'GRAND NAVE',
    platforms:Object.freeze([
      platform(512,544,10),
      platform(928,480,10),
      platform(1344,416,12),
      platform(1824,480,10),
      platform(2240,544,8),
    ]),
  }),
  cryptStair:Object.freeze({
    label:'CRYPT STAIR',
    platforms:Object.freeze([
      platform(512,544,8),
      platform(800,512,8),
      platform(1088,480,8),
      platform(1376,448,10),
      platform(1728,480,8),
      platform(2016,512,8),
      platform(2304,544,6),
    ]),
  }),
  ruinedGallery:Object.freeze({
    label:'RUINED GALLERY',
    platforms:Object.freeze([
      platform(512,544,11),
      platform(960,480,11),
      platform(1408,480,11),
      platform(1856,544,11),
      platform(864,384,8,'upper'),
      platform(1696,384,8,'upper'),
    ]),
  }),
  choirLoft:Object.freeze({
    label:'CHOIR LOFT',
    platforms:Object.freeze([
      platform(512,544,9),
      platform(864,480,9),
      platform(1216,416,9),
      platform(1536,416,9),
      platform(1888,480,9),
      platform(2240,544,8),
    ]),
  }),
});

const TEMPLATE_LAYOUTS=Object.freeze({
  duel:Object.freeze(['grandNave','cryptStair']),
  hunters:Object.freeze(['cryptStair','grandNave']),
  mixed:Object.freeze(['grandNave','choirLoft']),
  crossfire:Object.freeze(['ruinedGallery','choirLoft']),
  pressure:Object.freeze(['cryptStair','choirLoft']),
  barrage:Object.freeze(['ruinedGallery','choirLoft']),
  elite:Object.freeze(['grandNave','ruinedGallery']),
});

function stageHash(seed,depth,text=''){
  let h=((Number(seed)||1)>>>0)^Math.imul((depth+1)>>>0,0x9e3779b1);
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,0x01000193);
  }
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return h>>>0;
}

function groundSpawnsV31(){
  // Deliberately interleaved across the three encounter zones. The floor is
  // continuous, so every ground spawn sits on an unambiguous walkable surface.
  return[704,1280,1984,896,1536,2240,1024,1696,2432].map(x=>({
    x,y:560,minX:x-104,maxX:x+104,kind:'ground',
  }));
}

function perchSpawnsV31(platforms){
  const zoneBuckets=[[],[],[]];
  for(const spec of platforms.filter(spec=>spec.y<=512&&spec.w>=cells(8))){
    const x=spec.x+spec.w/2;
    const zone=x>=1792?2:x>=1088?1:0;
    zoneBuckets[zone].push({
      x,y:spec.y-44,minX:spec.x+40,maxX:spec.x+spec.w-40,kind:'perch',
    });
  }
  const spread=[];
  while(zoneBuckets.some(bucket=>bucket.length)){
    for(const bucket of zoneBuckets){
      const next=bucket.shift();
      if(next)spread.push(next);
    }
  }
  return spread;
}

export function chooseAuthoredLayoutV31(seed,depth=0,templateId='duel'){
  const pool=TEMPLATE_LAYOUTS[templateId]||['grandNave','cryptStair','choirLoft'];
  return pool[stageHash(seed,depth,`v31:${templateId}`)%pool.length];
}

export function generateAuthoredStageV31(seed,depth=0,templateId='duel'){
  const layoutId=chooseAuthoredLayoutV31(seed,depth,templateId);
  const authored=AUTHORED_STAGE_V31[layoutId];
  const floor={
    x:STAGE_FLOW_V24.left,
    y:ARENA_FLOOR_Y,
    w:STAGE_FLOW_V24.right-STAGE_FLOW_V24.left,
    h:cells(3),
    role:'floor',
  };
  const platforms=authored.platforms.map(spec=>({...spec}));
  return{
    roomSeed:stageHash(seed,depth,`v31-room:${templateId}`),
    grammar:layoutId,
    label:authored.label,
    chunks:[],
    player:{x:STAGE_FLOW_V24.playerStartX,y:560},
    floor,
    floorSegments:[floor],
    platforms,
    collision:[floor,...platforms],
    groundSpawns:groundSpawnsV31(),
    perchSpawns:perchSpawnsV31(platforms),
  };
}

export class GameSceneV31 extends GameSceneV30 {
  dressAuthoredWorldV31(){
    // Keep the reset deliberately sparse. The three recessed masonry panels
    // form one continuous background; V30's random arch/object/light stamping
    // is intentionally not called. Props return later through authored slots.
    for(const base of BACKGROUND_BASES)this.addBackgroundWallV30({base});
  }

  rebuildRoomLayout(template){
    if(template?.id==='boss1'){
      super.rebuildRoomLayout(template);
      return;
    }

    this.clearEnvironmentGeometry();
    const layout=generateAuthoredStageV31(
      this.runSeed||1,
      this.runGraphDepth||0,
      template?.id||'duel',
    );

    this.addEnvironmentCollider(layout.floor);
    for(const spec of layout.platforms)this.addTraversalCollider(spec);
    this.dressAuthoredWorldV31();
    this.renderGothicTerrain(layout.collision);

    this.environmentLayout=layout;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
    this.cameras?.main?.shake?.(45,.0008);
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    this.environmentDebugText.setText(
      `SEED ${this.runSeed>>>0} • ROOM ${(this.runGraphDepth||0)+1} • ${this.environmentLayout.label} • AUTHORED FLOW`
    );
  }
}
