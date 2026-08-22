import { GameSceneV34 } from './GameSceneV34.js';
import { ENVIRONMENT_ART_V30 } from './GameSceneV30.js';
import { frameForTerrainMask } from './GameSceneV22.js';

const FULL_STONE_FRAME=frameForTerrainMask(0);

function floorAtV35(floors,x){
  return (floors||[])
    .filter(spec=>x>=spec.x+8&&x<=spec.x+spec.w-8)
    .sort((a,b)=>a.y-b.y)[0]||null;
}

export class GameSceneV35 extends GameSceneV34 {
  create(){
    super.create();
    this.hidePrototypeTextV35();
    this.suppressPrototypeGeometryV35();
  }

  // V35 removes prototype/debug copy from the playfield. Route-choice menus
  // remain functional because they are an explicit decision screen, not a HUD.
  showRoomBanner(){}

  hidePrototypeTextV35(){
    for(const key of [
      'hud','debug','environmentDebugText','roomProgressText','runGraphText','runRouteText',
    ]){
      this[key]?.setVisible?.(false);
    }
    if(this.bossHud?.label)this.bossHud.label.setVisible(false);
  }

  updateHud(){
    super.updateHud();
    this.hud?.setVisible?.(false);
    this.debug?.setVisible?.(false);
  }

  updateEnvironmentDebugText(){
    this.environmentDebugText?.setVisible?.(false);
  }

  updateProgressText(){
    this.roomProgressText?.setVisible?.(false);
  }

  updateRunGraphText(){
    this.runGraphText?.setVisible?.(false);
  }

  setBossHudVisible(visible){
    super.setBossHudVisible(visible);
    if(this.bossHud?.label)this.bossHud.label.setVisible(false);
  }

  // The uploaded masonry is now a real visual surface rather than a tinted
  // low-opacity wash. Do not tint these layers: multiplying the already-dark
  // PixelLab artwork by the per-area tint made the texture disappear on phone.
  addParallaxTexturesV34(layout){
    const w=Math.max(1,this.scale.width);
    const h=Math.max(1,this.scale.height);
    const wallY=Math.max(72,h*.10);
    const archY=Math.max(190,h*.27);
    const nearY=Math.max(390,h*.56);

    const wall=this.add.tileSprite(
      0,wallY,w,Math.max(1,h-wallY),
      ENVIRONMENT_ART_V30.background.key,FULL_STONE_FRAME,
    ).setOrigin(0,0).setScrollFactor(0).setDepth(-8).setAlpha(.82);

    const architecture=this.add.tileSprite(
      0,archY,w,Math.max(1,h-archY),
      ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME,
    ).setOrigin(0,0).setScrollFactor(0).setDepth(-7).setAlpha(.56);

    const near=this.add.tileSprite(
      0,nearY,w,Math.max(1,h-nearY),
      ENVIRONMENT_ART_V30.background.key,FULL_STONE_FRAME,
    ).setOrigin(0,0).setScrollFactor(0).setDepth(-4).setAlpha(.30);

    this.addV28Decor(wall);
    this.addV28Decor(architecture);
    this.addV28Decor(near);

    const bays=this.addDepthBaysV35(layout);
    return{wall,architecture,near,bays};
  }

  addDepthBaysV35(layout){
    const bays=[];
    for(let index=0;index<layout.sections.length;index++){
      const section=layout.sections[index];
      const x=(section.start+section.end)*.5;
      const variant=(index+layout.stageIndex)%3;
      const openingTop=205+variant*28;
      const openingWidth=360+variant*54;
      const openingHeight=340-variant*18;

      const recess=this.add.graphics().setPosition(x,0).setScrollFactor(.48,1).setDepth(-6).setAlpha(.76);
      recess.fillStyle(0x020306,.88);
      recess.fillRect(-openingWidth*.5,openingTop,openingWidth,openingHeight);
      recess.fillCircle(0,openingTop,openingWidth*.5);
      this.addV28Decor(recess);

      const columnHeight=430+variant*34;
      const left=this.add.tileSprite(
        x-openingWidth*.5-70,430,72,columnHeight,
        ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME,
      ).setScrollFactor(.70,1).setDepth(-5).setAlpha(.68);
      const right=this.add.tileSprite(
        x+openingWidth*.5+70,430,72,columnHeight,
        ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME,
      ).setScrollFactor(.70,1).setDepth(-5).setAlpha(.68);
      const lintel=this.add.tileSprite(
        x,openingTop-36,openingWidth+210,64,
        ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME,
      ).setScrollFactor(.70,1).setDepth(-5).setAlpha(.62);

      this.addV28Decor(left);
      this.addV28Decor(right);
      this.addV28Decor(lintel);
      bays.push(recess,left,right,lintel);
    }
    return bays;
  }

  addParallaxSkylineV34(layout){
    const layers=super.addParallaxSkylineV34(layout);
    layers?.far?.setAlpha?.(.92);
    layers?.mid?.setAlpha?.(.86);
    return layers;
  }

  addStructuralFrameV34(x,floorY,theme,alpha=.30){
    return super.addStructuralFrameV34(x,floorY,theme,Math.max(.52,alpha));
  }

  resizeParallaxV34(){
    super.resizeParallaxV34();
    const p=this.v34Parallax;
    if(!p?.near)return;
    const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
    const nearY=Math.max(390,h*.56);
    p.near.setPosition(0,nearY).setSize(w,Math.max(1,h-nearY));
  }

  updateParallaxV34(){
    super.updateParallaxV34();
    const p=this.v34Parallax;
    if(!p)return;
    const scroll=this.cameras?.main?.scrollX||0;
    if(p.wall)p.wall.tilePositionX=scroll*.12;
    if(p.architecture)p.architecture.tilePositionX=scroll*.28;
    if(p.near)p.near.tilePositionX=scroll*.52;
  }

  // Replace the additive green rectangle with dark architectural ironwork.
  // The marker is small, non-additive, and only brightens after the area clears.
  addExitGateV34(layout){
    const ground=floorAtV35(layout.floorSegments,layout.exitX)||layout.floorSegments.at(-1);
    const y=ground?.y||640;
    this.addStructuralFrameV34(layout.exitX,y,layout.theme,.58);

    const iron=this.add.graphics().setDepth(3).setAlpha(.56);
    iron.lineStyle(4,0x596170,.96);
    for(const offset of [-34,-18,18,34]){
      iron.lineBetween(layout.exitX+offset,y-198,layout.exitX+offset,y-32);
    }
    iron.lineStyle(5,0x687181,.90);
    iron.lineBetween(layout.exitX-48,y-182,layout.exitX+48,y-182);
    this.addV28Decor(iron);

    const marker=this.add.circle(layout.exitX+74,y-38,5,0xa8b2ac,.32).setDepth(4);
    this.addV28Decor(marker);
    this.v34ExitPortal={portal:iron,core:marker};
  }

  suppressTellV35(enemy){
    if(!enemy?.tell)return;
    this.tweens.killTweensOf(enemy.tell);
    enemy.tell.setVisible(false).setAlpha(0);
  }

  // V20 also creates a separate red danger-lane rectangle during melee
  // windups. Disable it at the factory so it never reaches a rendered frame.
  createMeleeDangerLane(enemy){
    this.clearMeleeDangerLane?.(enemy);
    return null;
  }

  suppressPrototypeGeometryV35(){
    this.damageOverlay?.setVisible?.(false).setAlpha?.(0);
    this.attackFlash?.setVisible?.(false).setAlpha?.(0);
    this.attackArc?.setVisible?.(false);
    for(const enemy of this.enemies||[]){
      this.suppressTellV35(enemy);
      if(enemy?.dangerLane)this.clearMeleeDangerLane?.(enemy);
    }
  }

  // Keep damage readability on the actual character art. Remove the inherited
  // red full-screen overlay, floating HP text, and expanding red ring.
  showPlayerDamageFeedback(){
    this.damageOverlay?.setVisible?.(false).setAlpha?.(0);
    if(this.pixelArt?.setTintFill){
      this.pixelArt.setTintFill(0xffffff);
      this.time.delayedCall(95,()=>this.pixelArt?.clearTint?.());
    }
  }

  pulseEnemyArtV35(enemy,tint,duration){
    const art=enemy?.sprite?.art;
    if(!art)return;
    const token=(enemy.v35TellToken||0)+1;
    enemy.v35TellToken=token;
    this.tweens.killTweensOf(art);
    art.setTint?.(tint);
    art.setAlpha?.(.76);
    this.tweens.add({
      targets:art,
      alpha:1,
      duration:Math.max(70,Math.round(duration*.45)),
      yoyo:true,
      repeat:1,
      ease:'Sine.easeInOut',
      onComplete:()=>{
        if(enemy.v35TellToken!==token)return;
        art.setAlpha?.(1);
        art.clearTint?.();
      },
    });
  }

  beginMeleeWindup(enemy,time,dx){
    super.beginMeleeWindup(enemy,time,dx);
    this.suppressTellV35(enemy);
    this.clearMeleeDangerLane?.(enemy);
    this.pulseEnemyArtV35(enemy,0xe7a3aa,335);
  }

  beginTrollAim(enemy,time,dx){
    super.beginTrollAim(enemy,time,dx);
    this.suppressTellV35(enemy);
    this.pulseEnemyArtV35(enemy,0xd8c28d,300);
  }

  beginBossLunge(enemy,time){
    super.beginBossLunge(enemy,time);
    this.suppressTellV35(enemy);
    this.pulseEnemyArtV35(enemy,0xe2a3ad,300);
  }

  beginBossSlam(enemy,time){
    super.beginBossSlam(enemy,time);
    this.suppressTellV35(enemy);
    this.pulseEnemyArtV35(enemy,0xd4b08a,420);
  }

  loadRunNode(template,depth,transition=true){
    super.loadRunNode(template,depth,transition);
    this.hidePrototypeTextV35();
    this.suppressPrototypeGeometryV35();
  }

  update(time,delta){
    super.update(time,delta);
    this.hidePrototypeTextV35();
    this.suppressPrototypeGeometryV35();
    if(this.v34BossMode)return;

    const allDead=(this.enemies||[])
      .filter(enemy=>enemy?.type!=='boss1')
      .every(enemy=>!enemy.alive);
    if(this.v34ExitPortal){
      this.v34ExitPortal.portal.setAlpha(allDead?.78:.52);
      this.v34ExitPortal.core.setAlpha(allDead?.92:.28);
    }
  }
}
