import { GameSceneV31, generateAuthoredStageV31 } from './GameSceneV31.js';
import { ENVIRONMENT_ART_V30 } from './GameSceneV30.js';
import { STAGE_FLOW_V24 } from './GameSceneV24.js';
import {
  GOTHIC_TILE_SIZE,
  ARENA_FLOOR_Y,
  frameForTerrainMask,
} from './GameSceneV22.js';

const STAGE_WIDTH=STAGE_FLOW_V24.right-STAGE_FLOW_V24.left;
const STAGE_CENTER=STAGE_FLOW_V24.left+STAGE_WIDTH*.5;
const FULL_STONE_FRAME=frameForTerrainMask(0);

function architecture(x,y,w,h){return Object.freeze({x,y,w,h});}
function prop(asset,x,y,scale=1,alpha=.72,flipX=false){return Object.freeze({asset,x,y,scale,alpha,flipX});}
function light(asset,x,y,flipX=false){return Object.freeze({asset,x,y,flipX});}

// Every placement below is authored for a specific room grammar. The seed may
// choose the room grammar, but it never jitters props, lights, arches, or stone
// architecture inside that room. Across the four room types every uploaded
// background object, arch object, and candle/light variant is represented.
export const AUTHORED_DRESSING_V32=Object.freeze({
  grandNave:Object.freeze({
    architecture:Object.freeze([
      architecture(608,352,64,288),
      architecture(1280,320,64,320),
      architecture(2048,352,64,288),
    ]),
    arches:Object.freeze([
      prop(0,800,ARENA_FLOOR_Y-2,2.45,.46,false),
      prop(1,1952,ARENA_FLOOR_Y-2,2.45,.44,true),
    ]),
    objects:Object.freeze([
      prop(0,416,ARENA_FLOOR_Y-4,1.10,.68,false),
      prop(1,1184,ARENA_FLOOR_Y-4,1.05,.64,true),
      prop(2,2384,ARENA_FLOOR_Y-4,1.10,.68,false),
    ]),
    lights:Object.freeze([
      light(0,768,542,false),
      light(1,2304,542,true),
    ]),
  }),
  cryptStair:Object.freeze({
    architecture:Object.freeze([
      architecture(672,384,64,256),
      architecture(1440,352,64,288),
      architecture(2272,384,64,256),
    ]),
    arches:Object.freeze([
      prop(2,1472,ARENA_FLOOR_Y-2,2.50,.45,false),
    ]),
    objects:Object.freeze([
      prop(3,416,ARENA_FLOOR_Y-4,1.05,.66,false),
      prop(4,1568,ARENA_FLOOR_Y-4,1.08,.64,true),
      prop(5,2384,ARENA_FLOOR_Y-4,1.05,.66,false),
    ]),
    lights:Object.freeze([
      light(2,992,510,false),
      light(0,2368,542,true),
    ]),
  }),
  ruinedGallery:Object.freeze({
    architecture:Object.freeze([
      architecture(544,352,64,288),
      architecture(1056,352,64,288),
      architecture(1568,352,64,288),
      architecture(2080,352,64,288),
    ]),
    arches:Object.freeze([
      prop(3,864,ARENA_FLOOR_Y-2,2.35,.42,false),
      prop(4,1888,ARENA_FLOOR_Y-2,2.35,.42,true),
    ]),
    objects:Object.freeze([
      prop(6,416,ARENA_FLOOR_Y-4,1.05,.64,false),
      prop(7,1312,ARENA_FLOOR_Y-4,1.05,.62,true),
      prop(8,2384,ARENA_FLOOR_Y-4,1.05,.64,false),
    ]),
    lights:Object.freeze([
      light(1,800,542,false),
      light(2,1760,382,true),
    ]),
  }),
  choirLoft:Object.freeze({
    architecture:Object.freeze([
      architecture(704,352,64,288),
      architecture(1312,320,64,320),
      architecture(1952,352,64,288),
    ]),
    arches:Object.freeze([
      prop(4,1376,ARENA_FLOOR_Y-2,2.45,.44,false),
    ]),
    objects:Object.freeze([
      prop(9,416,ARENA_FLOOR_Y-4,1.05,.66,false),
      prop(10,1504,ARENA_FLOOR_Y-4,1.08,.64,true),
      prop(11,2384,ARENA_FLOOR_Y-4,1.05,.66,false),
    ]),
    lights:Object.freeze([
      light(0,1280,414,false),
      light(2,2304,542,true),
    ]),
  }),
});

export class GameSceneV32 extends GameSceneV31 {
  addContinuousBackgroundV32(){
    const wall=this.add.tileSprite(
      STAGE_CENTER,
      492,
      STAGE_WIDTH,
      292,
      ENVIRONMENT_ART_V30.background.key,
      FULL_STONE_FRAME,
    ).setDepth(0).setAlpha(.30);
    return this.addV28Decor(wall);
  }

  renderArchitectureV32(specs){
    const occupied=this.occupancyFor(specs);
    if(!occupied.size)return;
    const coords=[...occupied].map(key=>key.split(',').map(Number));
    const xs=coords.map(([x])=>x),ys=coords.map(([,y])=>y);
    const minX=Math.min(...xs),maxX=Math.max(...xs)+1;
    const minY=Math.min(...ys),maxY=Math.max(...ys)+1;
    const has=(x,y)=>occupied.has(`${x},${y}`);

    for(let vy=minY;vy<=maxY;vy++){
      for(let vx=minX;vx<=maxX;vx++){
        const mask=(has(vx-1,vy-1)?0:8)|
          (has(vx,vy-1)?0:4)|
          (has(vx-1,vy)?0:2)|
          (has(vx,vy)?0:1);
        if(mask===15)continue;
        const tile=this.add.image(
          vx*GOTHIC_TILE_SIZE,
          vy*GOTHIC_TILE_SIZE,
          ENVIRONMENT_ART_V30.architecture.key,
          frameForTerrainMask(mask),
        ).setOrigin(.5).setDepth(1).setAlpha(.34);
        this.addV28Decor(tile);
      }
    }
  }

  addAuthoredLightV32(slot,index){
    const asset=ENVIRONMENT_ART_V30.lights[slot.asset];
    if(!asset)return;
    const glow=this.add.circle(slot.x,slot.y-25,18,0xffa24a,.055)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(glow);
    this.addPixelLabProp(
      asset,
      slot.x,
      slot.y,
      {scale:1.12,alpha:.96,depth:5,flipX:slot.flipX},
    );
    this.tweens.add({
      targets:glow,
      alpha:.085,
      scale:1.08,
      yoyo:true,
      repeat:-1,
      duration:560+(index%2)*90,
      ease:'Sine.easeInOut',
    });
  }

  addAuthoredPropV32(collection,slot,depth){
    const asset=collection[slot.asset];
    if(!asset)return;
    this.addPixelLabProp(asset,slot.x,slot.y,{
      scale:slot.scale,
      alpha:slot.alpha,
      depth,
      flipX:slot.flipX,
    });
  }

  dressAuthoredWorldV32(layout){
    const dressing=AUTHORED_DRESSING_V32[layout?.grammar]||AUTHORED_DRESSING_V32.grandNave;

    // The three PixelLab tilesets each have one job:
    // 1) original a89e3ba5 = collision foreground (renderGothicTerrain inherited)
    // 2) recessed 965b1f4b = continuous rear wall
    // 3) pillar/arch 919c3a88 = non-collision architectural supports
    this.addContinuousBackgroundV32();
    this.renderArchitectureV32(dressing.architecture);

    for(const slot of dressing.arches)this.addAuthoredPropV32(ENVIRONMENT_ART_V30.arches,slot,2);
    for(const slot of dressing.objects)this.addAuthoredPropV32(ENVIRONMENT_ART_V30.backgroundObjects,slot,2);
    dressing.lights.forEach((slot,index)=>this.addAuthoredLightV32(slot,index));
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
    this.dressAuthoredWorldV32(layout);
    this.renderGothicTerrain(layout.collision);

    this.environmentLayout=layout;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
    this.cameras?.main?.shake?.(45,.0008);
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    this.environmentDebugText.setText(
      `SEED ${this.runSeed>>>0} • ROOM ${(this.runGraphDepth||0)+1} • ${this.environmentLayout.label} • AUTHORED ART`,
    );
  }
}
