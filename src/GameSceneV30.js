import { GameSceneV29 } from './GameSceneV29.js';
import {
  GOTHIC_TILE_SIZE,
  ARENA_FLOOR_Y,
  frameForTerrainMask,
} from './GameSceneV22.js';

const CHUNK_WIDTH=768;
const FULL_STONE_FRAME=frameForTerrainMask(0);

export const ENVIRONMENT_ART_V30=Object.freeze({
  foreground:Object.freeze({
    key:'gothic-ruins-terrain-v30',
    path:'./pixellab-tileset-ancient-dark-gothic-stone-masonry-large-worn-cracked-stone-p-606f17e2.png?v=v30',
  }),
  background:Object.freeze({
    key:'gothic-ruins-background-v30',
    path:'./pixellab-tileset-ancient-recessed-gothic-dungeon-wall-masonry-965b1f4b.png?v=v30',
  }),
  architecture:Object.freeze({
    key:'gothic-ruins-architecture-v30',
    path:'./pixellab-tileset-ancient-gothic-stone-pillar-and-arch-masonry-919c3a88.png?v=v30',
  }),
  lights:Object.freeze(Array.from({length:3},(_,index)=>Object.freeze({
    key:`v30-light-${index}`,
    path:`./assets/v30/environment/lights/lights_${String(index).padStart(2,'0')}.png?v=v30`,
  }))),
  backgroundObjects:Object.freeze(Array.from({length:12},(_,index)=>Object.freeze({
    key:`v30-background-${index}`,
    path:`./assets/v30/environment/background/background_${String(index).padStart(2,'0')}.png?v=v30`,
  }))),
  arches:Object.freeze(Array.from({length:5},(_,index)=>Object.freeze({
    key:`v30-arch-${index}`,
    path:`./assets/v30/environment/arches/arches_${String(index).padStart(2,'0')}.png?v=v30`,
  }))),
});

function variantIndex(seed,salt,count){
  let h=((Number(seed)||1)>>>0)^Math.imul((salt+1)>>>0,0x9e3779b1);
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return (h>>>0)%count;
}

function lightCandidates(layout){
  const floors=(layout?.floorSegments||[]).filter(spec=>spec.w>=160);
  if(!floors.length)return[];
  const result=[];
  for(let index=0;index<floors.length&&result.length<5;index+=2){
    const spec=floors[index];
    const inset=Math.min(72,Math.max(40,spec.w*.22));
    result.push({x:spec.x+inset,y:spec.y});
  }
  return result;
}

export class GameSceneV30 extends GameSceneV29 {
  preload(){
    super.preload();
    this.load.spritesheet(
      ENVIRONMENT_ART_V30.foreground.key,
      ENVIRONMENT_ART_V30.foreground.path,
      {frameWidth:GOTHIC_TILE_SIZE,frameHeight:GOTHIC_TILE_SIZE},
    );
    this.load.spritesheet(
      ENVIRONMENT_ART_V30.background.key,
      ENVIRONMENT_ART_V30.background.path,
      {frameWidth:GOTHIC_TILE_SIZE,frameHeight:GOTHIC_TILE_SIZE},
    );
    this.load.spritesheet(
      ENVIRONMENT_ART_V30.architecture.key,
      ENVIRONMENT_ART_V30.architecture.path,
      {frameWidth:GOTHIC_TILE_SIZE,frameHeight:GOTHIC_TILE_SIZE},
    );
    for(const asset of ENVIRONMENT_ART_V30.lights)this.load.image(asset.key,asset.path);
    for(const asset of ENVIRONMENT_ART_V30.backgroundObjects)this.load.image(asset.key,asset.path);
    for(const asset of ENVIRONMENT_ART_V30.arches)this.load.image(asset.key,asset.path);
  }

  // Use the new PixelLab stone terrain for every live V28 modular collider.
  // Collision geometry remains exactly the same; only the rendered sheet changes.
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
        const mask=(has(vx-1,vy-1)?0:8)|
          (has(vx,vy-1)?0:4)|
          (has(vx-1,vy)?0:2)|
          (has(vx,vy)?0:1);
        if(mask===15)continue;
        const tile=this.add.image(
          vx*GOTHIC_TILE_SIZE,
          vy*GOTHIC_TILE_SIZE,
          ENVIRONMENT_ART_V30.foreground.key,
          frameForTerrainMask(mask),
        ).setOrigin(.5).setDepth(6);
        this.environmentTerrainSprites.push(tile);
      }
    }
  }

  addPixelLabProp(asset,x,y,{scale=1,alpha=1,depth=2,flipX=false}={}){
    const sprite=this.add.image(x,y,asset.key)
      .setOrigin(.5,1)
      .setScale(scale)
      .setAlpha(alpha)
      .setDepth(depth)
      .setFlipX(flipX);
    return this.addV28Decor(sprite);
  }

  addPixelLabLight(asset,x,y,index){
    const glow=this.add.circle(x,y-28,22,0xffa24a,.065)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(glow);
    this.addPixelLabProp(asset,x,y,{scale:1.65,alpha:.96,depth:5,flipX:index%2===1});
    this.tweens.add({
      targets:glow,
      alpha:.105,
      scale:1.12,
      yoyo:true,
      repeat:-1,
      duration:520+(index%3)*80,
      ease:'Sine.easeInOut',
    });
  }

  addBackgroundWallV30(chunk){
    const wall=this.add.tileSprite(
      chunk.base+CHUNK_WIDTH*.5,
      492,
      CHUNK_WIDTH,
      292,
      ENVIRONMENT_ART_V30.background.key,
      FULL_STONE_FRAME,
    ).setDepth(0).setAlpha(.34);
    return this.addV28Decor(wall);
  }

  // V30 intentionally does not call V28's createTorch/createBackgroundArch/
  // createBrokenPillars/createHangingChains placeholders. All visible room
  // dressing below comes from the PixelLab files uploaded to the repository.
  dressModularWorldV28(layout){
    if(!layout?.chunks?.length)return;
    const seed=layout.roomSeed||1;

    layout.chunks.forEach((chunk,index)=>{
      this.addBackgroundWallV30(chunk);

      const archIndex=variantIndex(seed,index*11+1,ENVIRONMENT_ART_V30.arches.length);
      const arch=ENVIRONMENT_ART_V30.arches[archIndex];
      this.addPixelLabProp(
        arch,
        chunk.base+CHUNK_WIDTH*.5,
        ARENA_FLOOR_Y-2,
        {scale:3.35,alpha:.52,depth:1,flipX:index%2===1},
      );

      const leftIndex=variantIndex(seed,index*17+3,ENVIRONMENT_ART_V30.backgroundObjects.length);
      let rightIndex=variantIndex(seed,index*17+9,ENVIRONMENT_ART_V30.backgroundObjects.length);
      if(rightIndex===leftIndex)rightIndex=(rightIndex+5)%ENVIRONMENT_ART_V30.backgroundObjects.length;

      this.addPixelLabProp(
        ENVIRONMENT_ART_V30.backgroundObjects[leftIndex],
        chunk.base+190,
        ARENA_FLOOR_Y-4,
        {scale:2.05,alpha:.58,depth:2,flipX:(leftIndex+index)%2===1},
      );
      this.addPixelLabProp(
        ENVIRONMENT_ART_V30.backgroundObjects[rightIndex],
        chunk.base+CHUNK_WIDTH-178,
        ARENA_FLOOR_Y-4,
        {scale:2.2,alpha:.55,depth:2,flipX:(rightIndex+index)%2===0},
      );
    });

    lightCandidates(layout).forEach((position,index)=>{
      const lightIndex=variantIndex(seed,index*23+7,ENVIRONMENT_ART_V30.lights.length);
      this.addPixelLabLight(
        ENVIRONMENT_ART_V30.lights[lightIndex],
        position.x,
        position.y-3,
        index,
      );
    });
  }
}
