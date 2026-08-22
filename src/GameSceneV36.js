import { GameSceneV35 } from './GameSceneV35.js';
import { ENVIRONMENT_ART_V30 } from './GameSceneV30.js';
import { frameForTerrainMask } from './GameSceneV22.js';

const FULL_STONE_FRAME=frameForTerrainMask(0);

export const POLISH_V36=Object.freeze({
  cameraLerpX:.085,
  cameraLerpY:.11,
  cameraDeadzoneW:210,
  cameraDeadzoneH:120,
  lookAheadPx:128,
  floorShadowAlpha:.34,
  platformShadowAlpha:.26,
});

function floorAtV36(floors,x){
  return (floors||[])
    .filter(spec=>x>=spec.x+8&&x<=spec.x+spec.w-8)
    .sort((a,b)=>a.y-b.y)[0]||null;
}

export class GameSceneV36 extends GameSceneV35 {
  create(){
    super.create();
    this.v36CameraLook=0;
    this.applyCameraPolishV36();
    this.scale.on('resize',()=>this.applyCameraPolishV36());
  }

  applyCameraPolishV36(){
    const camera=this.cameras?.main;
    if(!camera||!this.player)return;
    camera.startFollow(
      this.player,
      true,
      POLISH_V36.cameraLerpX,
      POLISH_V36.cameraLerpY,
      0,
      42,
    );
    camera.setDeadzone(POLISH_V36.cameraDeadzoneW,POLISH_V36.cameraDeadzoneH);
  }

  addAtmosphereV36(){
    const layers=[];
    const h=Math.max(1,this.scale.height);
    for(let index=0;index<3;index++){
      const band=this.add.graphics()
        .setScrollFactor(0)
        .setDepth(-3+index)
        .setAlpha(.08-index*.015);
      band.fillStyle(index===0?0xc8d2df:0xaab5c2,1);
      const baseY=h*(.58+index*.10);
      for(let x=-240;x<this.scale.width+360;x+=420){
        band.fillEllipse(x+(index*137),baseY+(x%840?18:-10),520-index*70,64-index*8);
      }
      this.addV28Decor(band);
      layers.push(band);
    }
    return layers;
  }

  addSectionSilhouetteV36(layout,section,index){
    const center=(section.start+section.end)*.5;
    const ground=floorAtV36(layout.floorSegments,center)||layout.floorSegments[0];
    const floorY=ground?.y||640;
    const style=section.style||'entry';
    const narrow=style==='tower'||style==='crypt';
    const span=narrow?500:680;
    const top=Math.max(120,floorY-(narrow?430:360));
    const depth=-2;

    const recess=this.add.rectangle(center,(top+floorY)*.5,span,floorY-top,0x010204,.38)
      .setDepth(depth)
      .setScrollFactor(.84,1);
    this.addV28Decor(recess);

    for(const side of [-1,1]){
      const column=this.add.tileSprite(
        center+side*(span*.5+42),
        (top+floorY)*.5,
        64,
        floorY-top,
        ENVIRONMENT_ART_V30.architecture.key,
        FULL_STONE_FRAME,
      ).setDepth(depth+1).setScrollFactor(.90,1).setAlpha(.72);
      this.addV28Decor(column);
    }
    const lintel=this.add.tileSprite(
      center,
      top,
      span+148,
      64,
      ENVIRONMENT_ART_V30.architecture.key,
      FULL_STONE_FRAME,
    ).setDepth(depth+1).setScrollFactor(.90,1).setAlpha(.68);
    this.addV28Decor(lintel);

    if(index%2===0){
      const inner=this.add.tileSprite(
        center,
        floorY-150,
        Math.max(192,span*.56),
        48,
        ENVIRONMENT_ART_V30.background.key,
        FULL_STONE_FRAME,
      ).setDepth(depth+1).setScrollFactor(.87,1).setAlpha(.32);
      this.addV28Decor(inner);
    }
  }

  addTerrainDepthV36(layout){
    const all=[...(layout.floorSegments||[]),...(layout.platforms||[])];
    for(const spec of all){
      const floor=spec.role==='floor';
      const shadowH=floor?Math.min(42,Math.max(18,spec.h*.28)):18;
      const shadow=this.add.rectangle(
        spec.x+spec.w*.5,
        spec.y+spec.h+shadowH*.42,
        Math.max(8,spec.w-6),
        shadowH,
        0x000000,
        floor?POLISH_V36.floorShadowAlpha:POLISH_V36.platformShadowAlpha,
      ).setDepth(5).setOrigin(.5,0);
      this.addV28Decor(shadow);

      if(!floor){
        const lip=this.add.rectangle(
          spec.x+spec.w*.5,
          spec.y+3,
          Math.max(8,spec.w-12),
          3,
          0xb8bdc5,
          .13,
        ).setDepth(7);
        this.addV28Decor(lip);
      }
    }
  }

  addTraversalLightV33(slot,index){
    const asset=ENVIRONMENT_ART_V30.lights[slot.asset];
    if(!asset)return;

    const halo=this.add.circle(slot.x,slot.y-44,52,0xff9d52,.055)
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD);
    const pool=this.add.ellipse(slot.x,slot.y-2,150,30,0xffa15c,.045)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);
    const core=this.add.circle(slot.x,slot.y-31,18,0xffb56b,.075)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(halo);this.addV28Decor(pool);this.addV28Decor(core);

    this.addPixelLabProp(asset,slot.x,slot.y,{scale:.92,alpha:.96,depth:5,flipX:index%2===1});

    const duration=720+(index%3)*90;
    this.tweens.add({targets:halo,alpha:.085,scale:1.08,yoyo:true,repeat:-1,duration,ease:'Sine.easeInOut'});
    this.tweens.add({targets:core,alpha:.11,scale:1.05,yoyo:true,repeat:-1,duration:duration*.72,ease:'Sine.easeInOut'});
  }

  addStageDressingV34(layout){
    this.cameras.main.setBackgroundColor(layout.theme.bg);
    const skyline=this.addParallaxSkylineV34(layout);
    const textures=this.addParallaxTexturesV34(layout);
    const atmosphere=this.addAtmosphereV36();
    this.v34Parallax={...skyline,...textures,atmosphere,layout};

    layout.sections.forEach((section,index)=>this.addSectionSilhouetteV36(layout,section,index));

    for(const sectionIndex of [2,4,6]){
      const section=layout.sections[sectionIndex];
      const ground=floorAtV36(layout.floorSegments,section.start+80)||layout.floorSegments[0];
      this.addStructuralFrameV34(section.start+64,ground?.y||640,layout.theme,.44);
    }

    layout.lights.forEach((slot,index)=>this.addTraversalLightV33(slot,index));

    for(const slot of layout.objects){
      const asset=ENVIRONMENT_ART_V30.backgroundObjects[slot.asset];
      if(!asset)continue;
      const ground=floorAtV36(layout.floorSegments,slot.x);
      const y=ground?.y??slot.y;
      this.addPixelLabProp(asset,slot.x,y,{scale:.70,alpha:.50,depth:2,flipX:slot.flipX});
    }

    this.addExitGateV34(layout);
  }

  rebuildRoomLayout(template){
    super.rebuildRoomLayout(template);
    if(this.v34BossMode)return;
    const layout=this.environmentLayout;
    if(layout?.grammar!=='verticalRuinsExpedition')return;
    this.addTerrainDepthV36(layout);
    this.applyCameraPolishV36();
  }

  updateCameraPolishV36(){
    const camera=this.cameras?.main;
    const body=this.player?.body;
    if(!camera||!body)return;
    const velocity=body.velocity?.x||0;
    const target=Math.max(-POLISH_V36.lookAheadPx,Math.min(POLISH_V36.lookAheadPx,velocity*.34));
    this.v36CameraLook+=(target-this.v36CameraLook)*.055;
    camera.followOffset.x=-this.v36CameraLook;
  }

  update(time,delta){
    super.update(time,delta);
    this.updateCameraPolishV36();
    this.hidePrototypeTextV35();
    this.suppressPrototypeGeometryV35();
  }
}
