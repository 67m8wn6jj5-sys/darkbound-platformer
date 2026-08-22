import { GameSceneV33 } from './GameSceneV33.js';
import { ENVIRONMENT_ART_V30 } from './GameSceneV30.js';
import { GOTHIC_TILE_SIZE, frameForTerrainMask } from './GameSceneV22.js';

const FULL_STONE_FRAME=frameForTerrainMask(0);
const SECTION_WIDTH=1600;
const FLOOR_BOTTOM=736;

export const EXPEDITION_V34=Object.freeze({
  left:256,
  sectionWidth:SECTION_WIDTH,
  sectionsPerStage:8,
  right:256+SECTION_WIDTH*8,
  worldWidth:256+SECTION_WIDTH*8+256,
  worldHeight:800,
  fallResetY:820,
  activationDistancePx:900,
  exitTriggerDistancePx:300,
  normalStageCount:4,
});

const THEMES_V34=Object.freeze([
  Object.freeze({
    id:'cathedral',label:'FORSAKEN CATHEDRAL',bg:0x070910,far:0x121829,mid:0x1b2234,tint:0x8a91a3,
    labels:['CLOISTER ENTRY','BROKEN TRANSEPT','SHATTERED NAVE','CHOIR CHASM','BELL SUPPORTS','FALLEN CROSSING','LOWER VESTIBULE','SANCTUM GATE'],
    styles:['entry','rise','gallery','pit','tower','doublePit','descent','exit'],
  }),
  Object.freeze({
    id:'belltower',label:'THE SUNKEN BELLWORKS',bg:0x060810,far:0x111526,mid:0x20263a,tint:0x747d98,
    labels:['BELLHOUSE ENTRY','COUNTERWEIGHT SHAFT','CRACKED LANDING','HANGING CROSSING','UPPER MACHINERY','BELL CHASM','LOWER WINCH','IRON VESTIBULE'],
    styles:['entry','tower','rise','doublePit','gallery','tower','descent','exit'],
  }),
  Object.freeze({
    id:'ossuary',label:'THE BURIED OSSUARY',bg:0x060a09,far:0x101b19,mid:0x182824,tint:0x71867c,
    labels:['CRYPT MOUTH','BONE GALLERY','BURIAL RIFT','SEPULCHER RISE','OSSUARY WALK','GRAVE CHASM','LOWER CATACOMB','RELIQUARY GATE'],
    styles:['entry','crypt','pit','rise','crypt','doublePit','descent','exit'],
  }),
  Object.freeze({
    id:'ramparts',label:'BLACK RAMPARTS',bg:0x09070e,far:0x191321,mid:0x2a2030,tint:0x85748d,
    labels:['RAMPART ENTRY','OUTER WALL','BROKEN PARAPET','WATCHTOWER RISE','HIGH BATTLEMENT','SIEGE BREACH','INNER DESCENT','MOON GATE'],
    styles:['entry','rampart','doublePit','tower','rampart','pit','descent','exit'],
  }),
]);

function cells(count){return count*GOTHIC_TILE_SIZE;}
function floorSegment(x,y,w,section){return Object.freeze({x,y,w,h:FLOOR_BOTTOM-y,role:'floor',section});}
function platform(x,y,widthCells,role,section){return Object.freeze({x,y,w:cells(widthCells),h:GOTHIC_TILE_SIZE,role,section});}

function addSectionGeometry(base,style,section,floors,platforms){
  const f=(x,y,w)=>floors.push(floorSegment(base+x,y,w,section));
  const p=(x,y,w,role='route')=>platforms.push(platform(base+x,y,w,role,section));

  if(style==='entry'){
    f(0,640,1600);
    p(512,544,8);p(896,480,9,'upper');p(1280,544,7);
    return;
  }
  if(style==='rise'){
    f(0,640,480);f(480,608,480);f(960,576,640);
    p(320,544,6);p(736,512,7);p(1152,416,8,'upper');
    return;
  }
  if(style==='gallery'){
    f(0,640,1600);
    p(352,544,9);p(736,480,10);p(1184,416,8,'upper');p(864,352,7,'upper');
    return;
  }
  if(style==='pit'){
    f(0,640,672);f(800,640,800);
    p(544,544,10);p(960,448,10,'upper');p(1312,512,7);
    return;
  }
  if(style==='tower'){
    f(0,640,448);f(448,544,672);f(1120,640,480);
    p(320,576,6);p(624,416,9,'upper');p(1056,576,6);p(1280,480,7);
    return;
  }
  if(style==='doublePit'){
    f(0,640,416);f(544,640,512);f(1184,640,416);
    p(320,544,8);p(736,480,9);p(1088,544,8);p(704,384,7,'upper');
    return;
  }
  if(style==='descent'){
    f(0,576,576);f(576,608,480);f(1056,640,544);
    p(320,480,7,'upper');p(800,544,7);p(1248,512,7);
    return;
  }
  if(style==='crypt'){
    f(0,608,512);f(512,640,480);f(992,608,608);
    p(288,480,8,'upper');p(704,544,7);p(1120,480,9,'upper');
    return;
  }
  if(style==='rampart'){
    f(0,608,800);f(800,576,800);
    p(288,480,8,'upper');p(704,448,8,'upper');p(1120,416,9,'upper');
    return;
  }

  // Exit approaches deliberately settle back onto the baseline before the
  // transition gate so room completion never happens on an awkward ledge.
  f(0,608,448);f(448,640,1152);
  p(288,512,7);p(704,480,8,'upper');p(1120,544,8);
}

function floorAt(floors,x){
  return floors
    .filter(spec=>x>=spec.x+8&&x<=spec.x+spec.w-8)
    .sort((a,b)=>a.y-b.y)[0]||null;
}

function buildSpawns(floors,platforms,sections){
  const groundSpawns=[];
  for(const section of sections){
    for(const offset of [280,800,1320]){
      const x=section.start+offset;
      const ground=floorAt(floors,x);
      if(!ground)continue;
      groundSpawns.push({
        x,
        y:ground.y-80,
        minX:Math.max(ground.x+48,x-176),
        maxX:Math.min(ground.x+ground.w-48,x+176),
        kind:'ground',
      });
    }
  }

  const perchSpawns=platforms
    .filter(spec=>spec.role==='upper'||spec.y<=480)
    .sort((a,b)=>a.x-b.x||a.y-b.y)
    .map(spec=>({
      x:Math.round((spec.x+spec.w*.5)/32)*32,
      y:spec.y-44,
      minX:spec.x+32,
      maxX:spec.x+spec.w-32,
      kind:'perch',
    }));
  return{groundSpawns,perchSpawns};
}

function buildCheckpoints(floors,sections){
  return sections.map((section,index)=>{
    const x=section.start+(index===0?128:96);
    const ground=floorAt(floors,x)||floorAt(floors,section.start+320);
    return Object.freeze({x,y:(ground?.y||640)-80,section:index});
  });
}

function buildDressing(floors,sections,depth){
  const lights=[];
  for(let index=0;index<sections.length;index++){
    const x=sections[index].start+(index%2===0?240:1360);
    const ground=floorAt(floors,x)||floorAt(floors,sections[index].start+320);
    if(ground)lights.push(Object.freeze({asset:index%3,x,y:ground.y-2}));
  }

  // Three restrained floor/background props per stage. Across the four normal
  // areas this gives all twelve uploaded object variants an intentional home.
  const objects=[];
  [1,3,6].forEach((sectionIndex,slotIndex)=>{
    const section=sections[sectionIndex];
    const x=section.start+(slotIndex===1?1260:260);
    const ground=floorAt(floors,x)||floorAt(floors,section.start+400);
    if(ground)objects.push(Object.freeze({asset:depth*3+slotIndex,x,y:ground.y-2,flipX:(depth+slotIndex)%2===1}));
  });
  return{lights:Object.freeze(lights),objects:Object.freeze(objects)};
}

export function generateExpeditionStageV34(seed=1,depth=0,templateId='duel'){
  const stageIndex=Math.max(0,Math.min(THEMES_V34.length-1,Number(depth)||0));
  const theme=THEMES_V34[stageIndex];
  const floors=[];
  const platforms=[];
  const sections=[];

  for(let index=0;index<EXPEDITION_V34.sectionsPerStage;index++){
    const start=EXPEDITION_V34.left+index*SECTION_WIDTH;
    const end=start+SECTION_WIDTH;
    const section=Object.freeze({
      id:`${theme.id}-${index+1}`,
      label:theme.labels[index],
      style:theme.styles[index],
      start,end,
    });
    sections.push(section);
    addSectionGeometry(start,section.style,section.id,floors,platforms);
  }

  const spawns=buildSpawns(floors,platforms,sections);
  const checkpoints=buildCheckpoints(floors,sections);
  const dressing=buildDressing(floors,sections,stageIndex);
  return{
    roomSeed:(((Number(seed)||1)>>>0)^Math.imul((stageIndex+1)>>>0,0x9e3779b1))>>>0,
    grammar:'verticalRuinsExpedition',
    label:theme.label,
    theme,
    templateId,
    stageIndex,
    player:{x:checkpoints[0].x,y:checkpoints[0].y},
    sections,
    checkpoints,
    floorSegments:floors.map(spec=>({...spec})),
    platforms:platforms.map(spec=>({...spec})),
    collision:[...floors.map(spec=>({...spec})),...platforms.map(spec=>({...spec}))],
    groundSpawns:spawns.groundSpawns,
    perchSpawns:spawns.perchSpawns,
    lights:[...dressing.lights],
    objects:[...dressing.objects],
    exitX:EXPEDITION_V34.right-224,
    worldWidth:EXPEDITION_V34.worldWidth,
  };
}

function rosterPattern(templateId){
  if(templateId==='hunters')return['enemy1','enemy1','enemy1','enemy2'];
  if(templateId==='crossfire')return['enemy2','enemy1','enemy2','enemy1'];
  if(templateId==='pressure')return['enemy1','enemy1','enemy2','enemy1','enemy2'];
  if(templateId==='barrage')return['enemy2','enemy1','enemy2','enemy2','enemy1'];
  if(templateId==='mixed')return['enemy1','enemy2','enemy1','enemy1'];
  if(templateId==='elite')return['enemy1','enemy2','enemy1','enemy2'];
  return['enemy1','enemy1','enemy1','enemy2'];
}

export function expandedRosterV34(templateId,depth=0,elite=false){
  const count=elite?16:[10,12,14,16][Math.max(0,Math.min(3,Number(depth)||0))];
  const pattern=rosterPattern(templateId);
  return Array.from({length:count},(_,index)=>pattern[index%pattern.length]);
}

export class GameSceneV34 extends GameSceneV33 {
  drawBackground(){
    // Per-area layered backgrounds are created after the current expedition
    // layout exists. Base creation only needs a clean dark clear color.
    this.cameras.main.setBackgroundColor('#070910');
  }

  create(){
    super.create();
    this.v34Parallax=null;
    this.v34CheckpointIndex=0;
    this.v34ExitPrompted=false;
    this.v34BossMode=this.runHistory?.[this.runGraphDepth]?.id==='boss1';
    if(!this.v34BossMode&&this.environmentLayout?.grammar==='verticalRuinsExpedition'){
      this.applyWorldBoundsV34(this.environmentLayout);
    }
    this.scale.on('resize',()=>this.resizeParallaxV34());
  }

  // V16 was intentionally a boss-test build and disabled the opening route
  // branch. Restore the actual five-node run: four traversal areas, then boss.
  isBranchDepth(depth){return depth===0||depth===2;}

  expandTemplateV24(template,depth){
    if(!template||template.id==='boss1')return template;
    return{
      ...template,
      enemies:expandedRosterV34(template.id,depth,!!template.elite),
      subtitle:`${template.subtitle||template.name} • expedition encounter`,
    };
  }

  applyWorldBoundsV34(layout){
    this.worldWidth=layout?.worldWidth||EXPEDITION_V34.worldWidth;
    this.worldHeight=EXPEDITION_V34.worldHeight;
    this.cameras?.main?.setBounds?.(0,0,this.worldWidth,this.worldHeight);
    this.physics?.world?.setBounds?.(0,0,this.worldWidth,this.worldHeight+300);
  }

  applyBossBoundsV34(){
    this.worldWidth=2140;
    this.worldHeight=720;
    this.cameras?.main?.setBounds?.(0,0,this.worldWidth,this.worldHeight);
    this.physics?.world?.setBounds?.(0,0,this.worldWidth,this.worldHeight+300);
  }

  addParallaxSkylineV34(layout){
    const theme=layout.theme;
    const width=3000;
    const far=this.add.graphics().setScrollFactor(0).setDepth(-10).setAlpha(.72);
    far.fillStyle(theme.far,1);
    for(let x=0;x<width;x+=250){
      const variant=((x/250)+layout.stageIndex)%4;
      const towerH=150+variant*42;
      const towerW=96+(variant%2)*36;
      far.fillRect(x,640-towerH,towerW,towerH);
      far.fillTriangle(x-18,640-towerH,x+towerW*.5,640-towerH-90-variant*14,x+towerW+18,640-towerH);
    }
    this.addV28Decor(far);

    const mid=this.add.graphics().setScrollFactor(0).setDepth(-9).setAlpha(.60);
    mid.fillStyle(theme.mid,1);
    for(let x=0;x<width;x+=360){
      const h=120+((x/360+layout.stageIndex)%3)*46;
      mid.fillRect(x,640-h,210,h);
      mid.fillRect(x+58,640-h-76,56,76);
      mid.fillTriangle(x+42,640-h-76,x+86,640-h-132,x+130,640-h-76);
    }
    this.addV28Decor(mid);
    return{far,mid};
  }

  addParallaxTexturesV34(layout){
    const w=Math.max(1,this.scale.width);
    const h=Math.max(1,this.scale.height);
    const theme=layout.theme;
    const wall=this.add.tileSprite(0,Math.max(150,h*.24),w,Math.max(1,h-Math.max(150,h*.24)),ENVIRONMENT_ART_V30.background.key,FULL_STONE_FRAME)
      .setOrigin(0,0).setScrollFactor(0).setDepth(-8).setAlpha(.13).setTint(theme.tint);
    const architecture=this.add.tileSprite(0,Math.max(270,h*.42),w,Math.max(1,h-Math.max(270,h*.42)),ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME)
      .setOrigin(0,0).setScrollFactor(0).setDepth(-7).setAlpha(.065).setTint(theme.tint);
    this.addV28Decor(wall);this.addV28Decor(architecture);
    return{wall,architecture};
  }

  addStructuralFrameV34(x,floorY,theme,alpha=.30){
    const height=Math.max(224,floorY-300);
    const top=floorY-height;
    const left=this.add.tileSprite(x-96,top+height*.5,64,height,ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME)
      .setDepth(1).setAlpha(alpha).setTint(theme.tint);
    const right=this.add.tileSprite(x+96,top+height*.5,64,height,ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME)
      .setDepth(1).setAlpha(alpha).setTint(theme.tint);
    const lintel=this.add.tileSprite(x,top,256,40,ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME)
      .setDepth(1).setAlpha(alpha).setTint(theme.tint);
    this.addV28Decor(left);this.addV28Decor(right);this.addV28Decor(lintel);
  }

  addExitGateV34(layout){
    const ground=floorAt(layout.floorSegments,layout.exitX)||layout.floorSegments.at(-1);
    const y=ground?.y||640;
    this.addStructuralFrameV34(layout.exitX,y,layout.theme,.52);
    const portal=this.add.rectangle(layout.exitX,y-118,82,190,0x43ff57,.045)
      .setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
    const core=this.add.rectangle(layout.exitX,y-118,4,166,0xbfff8f,.18)
      .setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(portal);this.addV28Decor(core);
    this.v34ExitPortal={portal,core};
  }

  addStageDressingV34(layout){
    this.cameras.main.setBackgroundColor(layout.theme.bg);
    const skyline=this.addParallaxSkylineV34(layout);
    const textures=this.addParallaxTexturesV34(layout);
    this.v34Parallax={...skyline,...textures,layout};

    // Complete frames mark major transitions. No tiny arch-object exports are
    // enlarged or scattered; architecture is assembled from full structural
    // columns and lintels instead.
    for(const sectionIndex of [1,3,5,7]){
      const section=layout.sections[sectionIndex];
      const ground=floorAt(layout.floorSegments,section.start+96)||layout.floorSegments[0];
      this.addStructuralFrameV34(section.start+80,ground?.y||640,layout.theme,.24);
    }

    layout.lights.forEach((slot,index)=>this.addTraversalLightV33(slot,index));
    for(const slot of layout.objects){
      const asset=ENVIRONMENT_ART_V30.backgroundObjects[slot.asset];
      if(!asset)continue;
      this.addPixelLabProp(asset,slot.x,slot.y,{scale:.78,alpha:.42,depth:2,flipX:slot.flipX});
    }
    this.addExitGateV34(layout);
  }

  resizeParallaxV34(){
    const p=this.v34Parallax;
    if(!p?.wall||!p?.architecture)return;
    const w=Math.max(1,this.scale.width),h=Math.max(1,this.scale.height);
    const wallY=Math.max(150,h*.24),archY=Math.max(270,h*.42);
    p.wall.setPosition(0,wallY).setSize(w,Math.max(1,h-wallY));
    p.architecture.setPosition(0,archY).setSize(w,Math.max(1,h-archY));
  }

  updateParallaxV34(){
    const p=this.v34Parallax;
    if(!p)return;
    const scroll=this.cameras?.main?.scrollX||0;
    if(p.far)p.far.x=-(scroll*.08%1500);
    if(p.mid)p.mid.x=-(scroll*.16%1500);
    if(p.wall)p.wall.tilePositionX=scroll*.22;
    if(p.architecture)p.architecture.tilePositionX=scroll*.38;
  }

  rebuildRoomLayout(template){
    if(template?.id==='boss1'){
      this.v34BossMode=true;
      super.rebuildRoomLayout(template);
      this.applyBossBoundsV34();
      this.v34Parallax=null;
      return;
    }

    this.v34BossMode=false;
    this.clearEnvironmentGeometry();
    const layout=generateExpeditionStageV34(
      this.runSeed||1,
      this.runGraphDepth||0,
      template?.id||'duel',
    );
    this.applyWorldBoundsV34(layout);

    for(const spec of layout.floorSegments)this.addEnvironmentCollider(spec);
    for(const spec of layout.platforms)this.addTraversalCollider(spec);
    // Rendering and collision use the exact same floor segments. Every visible
    // chasm in V34 is a real opening in collision, and every raised floor is
    // actually raised in physics.
    this.renderGothicTerrain([...layout.floorSegments,...layout.platforms]);
    this.addStageDressingV34(layout);

    this.environmentLayout=layout;
    this.v34CheckpointIndex=0;
    this.v34ExitPrompted=false;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
  }

  configureStageActivationV24(){
    if(this.v34BossMode)return super.configureStageActivationV24();
    const now=this.time?.now||0;
    const layout=this.environmentLayout;
    const distance=EXPEDITION_V34.activationDistancePx;
    const sorted=[...(this.enemies||[])]
      .filter(enemy=>enemy?.alive&&enemy.type!=='boss1')
      .sort((a,b)=>(a.sprite?.x||0)-(b.sprite?.x||0));
    sorted.forEach((enemy,index)=>{
      enemy.v34StageIndex=index;
      enemy.v34ActivationX=Math.max(EXPEDITION_V34.left,(enemy.sprite?.x||0)-distance);
      this.setEnemyDormant(enemy,true);
      if(enemy.sprite?.body)enemy.sprite.body.enable=true;
      enemy.nextAttackAt=now+680+index*70;
    });
    if(layout)this.updateCheckpointV34();
  }

  updateStageActivationV24(time){
    if(this.v34BossMode)return super.updateStageActivationV24(time);
    if(this.dead||this.rewardActive||this.routeActive)return;
    const playerX=this.player?.x??EXPEDITION_V34.left;
    for(const enemy of this.enemies||[]){
      if(!enemy?.alive||!enemy.roomDormant||enemy.type==='boss1')continue;
      if(playerX>=enemy.v34ActivationX)this.activateTraversalEnemyV33(enemy,time);
    }
  }

  updateCheckpointV34(){
    const layout=this.environmentLayout;
    if(!layout?.checkpoints?.length||!this.player)return;
    const x=this.player.x;
    for(let index=this.v34CheckpointIndex+1;index<layout.checkpoints.length;index++){
      if(x>=layout.checkpoints[index].x+160)this.v34CheckpointIndex=index;
      else break;
    }
  }

  respawnAtCheckpointV34(){
    const layout=this.environmentLayout;
    const point=layout?.checkpoints?.[this.v34CheckpointIndex]||layout?.player;
    if(!point||!this.player)return;
    this.player.setPosition(point.x,point.y);
    this.player.body?.reset?.(point.x,point.y);
    this.player.body?.setVelocity?.(0,0);
    this.playerHp=Math.max(1,(this.playerHp||1)-1);
    this.playerInvulnEndsAt=(this.time?.now||0)+650;
    this.updateHud?.();
    this.cameras?.main?.shake?.(90,.004);
  }

  updateMultiRoomProgression(time){
    if(this.v34BossMode)return super.updateMultiRoomProgression(time);
    const room=this.rooms?.[0];
    if(!room||room.state!=='combat'||room.clearPending)return;
    const allDead=room.enemies.every(enemy=>!enemy.alive);
    if(!allDead){
      this.v34ExitPrompted=false;
      return;
    }

    const exitX=this.environmentLayout?.exitX||EXPEDITION_V34.right;
    if((this.player?.x||0)<exitX-EXPEDITION_V34.exitTriggerDistancePx){
      if(!this.v34ExitPrompted){
        this.v34ExitPrompted=true;
        this.showRoomBanner('AREA CLEARED • REACH THE GREEN GATE',1100);
      }
      return;
    }
    super.updateMultiRoomProgression(time);
  }

  loadRunNode(template,depth,transition=true){
    this.v34BossMode=template?.id==='boss1';
    super.loadRunNode(template,depth,transition);
    if(this.v34BossMode)this.applyBossBoundsV34();
    else if(this.environmentLayout?.grammar==='verticalRuinsExpedition')this.applyWorldBoundsV34(this.environmentLayout);
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    if(this.v34BossMode){
      super.updateEnvironmentDebugText();
      return;
    }
    const x=Math.round(this.player?.x||EXPEDITION_V34.left);
    const section=this.environmentLayout.sections?.find(item=>x>=item.start&&x<item.end);
    const alive=this.enemies?.filter(enemy=>enemy?.alive&&enemy.type!=='boss1').length||0;
    this.environmentDebugText.setText(
      `AREA ${Math.min(4,(this.runGraphDepth||0)+1)}/4 • ${this.environmentLayout.label} • ${section?.label||'PASSAGE'} • ${alive} HOSTILES`,
    );
  }

  update(time,delta){
    if(!this.v34BossMode&&this.player?.y>EXPEDITION_V34.fallResetY)this.respawnAtCheckpointV34();
    super.update(time,delta);
    if(this.v34BossMode)return;
    this.updateCheckpointV34();
    this.updateParallaxV34();
    const allDead=(this.enemies||[]).filter(enemy=>enemy?.type!=='boss1').every(enemy=>!enemy.alive);
    if(this.v34ExitPortal){
      this.v34ExitPortal.portal.setAlpha(allDead?.13:.045);
      this.v34ExitPortal.core.setAlpha(allDead?.42:.18);
    }
  }
}
