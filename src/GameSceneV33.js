import { GameSceneV32 } from './GameSceneV32.js';
import { ENVIRONMENT_ART_V30 } from './GameSceneV30.js';
import { GOTHIC_TILE_SIZE, frameForTerrainMask } from './GameSceneV22.js';

export const LONG_STAGE_V33=Object.freeze({
  left:256,
  right:9728,
  worldWidth:9984,
  floorY:640,
  playerStartX:384,
  playerY:560,
  activationDistancePx:760,
  label:'FORSAKEN CATHEDRAL PASSAGE',
});

const FULL_STONE_FRAME=frameForTerrainMask(0);

function cells(count){return count*GOTHIC_TILE_SIZE;}
function platform(x,y,widthCells,role='route',section=''){return Object.freeze({x,y,w:cells(widthCells),h:GOTHIC_TILE_SIZE,role,section});}

export const AUTHORED_TRAVERSAL_V33=Object.freeze({
  sections:Object.freeze([
    Object.freeze({id:'entry',label:'ENTRY CLOISTER',start:256,end:1536}),
    Object.freeze({id:'ascent',label:'BROKEN ASCENT',start:1536,end:2816}),
    Object.freeze({id:'nave',label:'FALLEN NAVE',start:2816,end:4224}),
    Object.freeze({id:'crossing',label:'HIGH CROSSING',start:4224,end:5504}),
    Object.freeze({id:'descent',label:'CRYPT DESCENT',start:5504,end:6784}),
    Object.freeze({id:'crypt',label:'BURIED CRYPT',start:6784,end:8192}),
    Object.freeze({id:'exit',label:'RUINED APPROACH',start:8192,end:9728}),
  ]),
  platforms:Object.freeze([
    platform(704,544,8,'route','entry'),
    platform(1056,480,9,'route','entry'),

    platform(1600,544,8,'route','ascent'),
    platform(1920,480,8,'route','ascent'),
    platform(2240,416,9,'route','ascent'),
    platform(2592,480,8,'route','ascent'),

    platform(2912,544,11,'route','nave'),
    platform(3360,480,11,'route','nave'),
    platform(3808,544,11,'route','nave'),
    platform(3424,384,8,'upper','nave'),

    platform(4320,512,9,'route','crossing'),
    platform(4672,448,9,'route','crossing'),
    platform(5024,512,9,'route','crossing'),

    platform(5600,416,9,'route','descent'),
    platform(5952,480,9,'route','descent'),
    platform(6304,544,9,'route','descent'),

    platform(6880,544,11,'route','crypt'),
    platform(7328,480,11,'route','crypt'),
    platform(7776,544,11,'route','crypt'),
    platform(7456,384,8,'upper','crypt'),

    platform(8288,544,9,'route','exit'),
    platform(8640,480,9,'route','exit'),
    platform(8992,416,10,'route','exit'),
  ]),
  lights:Object.freeze([
    Object.freeze({asset:0,x:896,y:638}),
    Object.freeze({asset:1,x:2272,y:414}),
    Object.freeze({asset:2,x:3328,y:638}),
    Object.freeze({asset:0,x:4800,y:446}),
    Object.freeze({asset:1,x:6176,y:638}),
    Object.freeze({asset:2,x:7456,y:382}),
    Object.freeze({asset:0,x:8544,y:638}),
    Object.freeze({asset:1,x:9248,y:638}),
  ]),
});

function groundSpawn(x){return{x,y:560,minX:x-176,maxX:x+176,kind:'ground'};}
function perchSpawn(x,y,minX,maxX){return{x,y,minX,maxX,kind:'perch'};}

export function generateLongTraversalV33(seed=1,depth=0,templateId='duel'){
  const floor={
    x:LONG_STAGE_V33.left,
    y:LONG_STAGE_V33.floorY,
    w:LONG_STAGE_V33.right-LONG_STAGE_V33.left,
    h:cells(3),
    role:'floor',
  };
  const platforms=AUTHORED_TRAVERSAL_V33.platforms.map(spec=>({...spec}));
  return{
    roomSeed:(((Number(seed)||1)>>>0)^Math.imul((depth+1)>>>0,0x9e3779b1))>>>0,
    grammar:'longTraversal',
    label:LONG_STAGE_V33.label,
    templateId,
    sections:AUTHORED_TRAVERSAL_V33.sections.map(section=>({...section})),
    player:{x:LONG_STAGE_V33.playerStartX,y:LONG_STAGE_V33.playerY},
    floor,
    floorSegments:[floor],
    platforms,
    collision:[floor,...platforms],
    groundSpawns:[1600,3040,4480,5856,7136,8576].map(groundSpawn),
    perchSpawns:[
      perchSpawn(2080,436,1952,2176),
      perchSpawn(3536,436,3392,3648),
      perchSpawn(4800,404,4704,4896),
      perchSpawn(6080,436,5984,6176),
      perchSpawn(7584,340,7488,7680),
      perchSpawn(8800,436,8672,8928),
    ],
  };
}

export class GameSceneV33 extends GameSceneV32 {
  // V33 deliberately removes the previous masonry wallpaper and oversized arch
  // treatment. Until a proper parallax/background composition exists, a quiet
  // dark field is preferable to visual noise that fights the gameplay route.
  drawBackground(){
    this.cameras.main.setBackgroundColor('#070910');
  }

  create(){
    super.create();
    if(!this.v33BossMode)this.applyLongWorldBoundsV33();
  }

  applyLongWorldBoundsV33(){
    this.worldWidth=LONG_STAGE_V33.worldWidth;
    this.worldHeight=720;
    this.cameras?.main?.setBounds?.(0,0,LONG_STAGE_V33.worldWidth,this.worldHeight);
    this.physics?.world?.setBounds?.(0,0,LONG_STAGE_V33.worldWidth,this.worldHeight+300);
  }

  renderSolidFloorV33(floor){
    this.environmentTerrainSprites=this.environmentTerrainSprites||[];
    const cols=Math.max(1,Math.round(floor.w/GOTHIC_TILE_SIZE));
    const rows=Math.max(1,Math.round(floor.h/GOTHIC_TILE_SIZE));
    const x0=Math.round(floor.x/GOTHIC_TILE_SIZE);
    const y0=Math.round(floor.y/GOTHIC_TILE_SIZE);
    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++){
        const tile=this.add.image(
          (x0+col)*GOTHIC_TILE_SIZE+GOTHIC_TILE_SIZE*.5,
          (y0+row)*GOTHIC_TILE_SIZE+GOTHIC_TILE_SIZE*.5,
          ENVIRONMENT_ART_V30.foreground.key,
          FULL_STONE_FRAME,
        ).setOrigin(.5).setDepth(6);
        this.environmentTerrainSprites.push(tile);
      }
    }
  }

  renderLongTerrainV33(layout){
    // Floor pixels and floor collision are generated from the same rectangle.
    // There are no decorative/fake pits in V33.
    this.renderSolidFloorV33(layout.floor);
    this.renderGothicTerrain(layout.platforms);
  }

  addTraversalLightV33(slot,index){
    const asset=ENVIRONMENT_ART_V30.lights[slot.asset];
    if(!asset)return;
    const glow=this.add.circle(slot.x,slot.y-22,14,0xff9c46,.045)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(glow);
    this.addPixelLabProp(asset,slot.x,slot.y,{scale:.92,alpha:.94,depth:5,flipX:index%2===1});
    this.tweens.add({
      targets:glow,
      alpha:.07,
      scale:1.06,
      yoyo:true,
      repeat:-1,
      duration:620+(index%3)*70,
      ease:'Sine.easeInOut',
    });
  }

  dressLongTraversalV33(){
    // Only small, deliberate light landmarks survive the environment reset.
    // No V32 masonry background, arch objects, pillar tiles, or random props.
    AUTHORED_TRAVERSAL_V33.lights.forEach((slot,index)=>this.addTraversalLightV33(slot,index));
  }

  rebuildRoomLayout(template){
    if(template?.id==='boss1'){
      this.v33BossMode=true;
      super.rebuildRoomLayout(template);
      return;
    }

    this.v33BossMode=false;
    this.applyLongWorldBoundsV33();
    this.clearEnvironmentGeometry();
    const layout=generateLongTraversalV33(
      this.runSeed||1,
      this.runGraphDepth||0,
      template?.id||'duel',
    );

    this.addEnvironmentCollider(layout.floor);
    for(const spec of layout.platforms)this.addTraversalCollider(spec);
    this.renderLongTerrainV33(layout);
    this.dressLongTraversalV33();

    this.environmentLayout=layout;
    this.placeEnvironmentActors(layout);
    this.updateEnvironmentDebugText();
  }

  // Normal traversal levels are never sealed. The old arena system created
  // invisible physics blockers at the stage edges; V33 removes them entirely.
  replaceStageGatesV24(isBoss=false){
    this.v33BossMode=!!isBoss;
    if(isBoss){
      super.replaceStageGatesV24(true);
      return;
    }
    this.clearV28Gates();
    this.v24ZoneGateStates=new Map();
    this.v24ZoneGateXs=[];
    this.v24OuterGateXs=[];
  }

  setArenaLocked(locked){
    if(this.v33BossMode){
      super.setArenaLocked(locked);
      return;
    }
    this.clearV28Gates();
    this.v24ZoneGateXs=[];
    this.v24OuterGateXs=[];
  }

  configureStageActivationV24(){
    if(this.v33BossMode)return super.configureStageActivationV24();
    const now=this.time?.now||0;
    const sorted=[...(this.enemies||[])]
      .filter(enemy=>enemy?.alive&&enemy.type!=='boss1')
      .sort((a,b)=>(a.sprite?.x||0)-(b.sprite?.x||0));
    sorted.forEach((enemy,index)=>{
      enemy.v33StageIndex=index;
      enemy.v33ActivationX=Math.max(
        LONG_STAGE_V33.left,
        (enemy.sprite?.x||0)-LONG_STAGE_V33.activationDistancePx,
      );
      this.setEnemyDormant(enemy,true);
      if(enemy.sprite?.body)enemy.sprite.body.enable=true;
      enemy.nextAttackAt=now+700+index*120;
    });
  }

  activateTraversalEnemyV33(enemy,time){
    if(!enemy?.alive||!enemy.roomDormant)return;
    this.setEnemyDormant(enemy,false);
    if(enemy.sprite?.body){
      enemy.sprite.body.enable=true;
      enemy.sprite.body.setVelocity(0,0);
    }
    enemy.nextAttackAt=time+500+(enemy.v33StageIndex||0)*80;
    if(enemy.type==='enemy2'){
      enemy.state='ranged';
      this.setTrollAnim(enemy,'patrol',time,true);
    }else{
      enemy.state='engage';
      this.setEnemyAnim(enemy,'patrol',time,true);
    }
  }

  updateStageActivationV24(time){
    if(this.v33BossMode)return super.updateStageActivationV24(time);
    if(this.dead||this.rewardActive||this.routeActive)return;
    const playerX=this.player?.x??LONG_STAGE_V33.playerStartX;
    for(const enemy of this.enemies||[]){
      if(!enemy?.alive||!enemy.roomDormant||enemy.type==='boss1')continue;
      if(playerX>=enemy.v33ActivationX)this.activateTraversalEnemyV33(enemy,time);
    }
  }

  setStageZoneGateLockedV24(){}
  updateStageZoneGatesV24(){}

  loadRunNode(template,depth,transition=true){
    this.v33BossMode=template?.id==='boss1';
    super.loadRunNode(template,depth,transition);
    if(!this.v33BossMode)this.applyLongWorldBoundsV33();
  }

  updateEnvironmentDebugText(){
    if(!this.environmentDebugText||!this.environmentLayout)return;
    const playerX=Math.round(this.player?.x||LONG_STAGE_V33.playerStartX);
    const section=this.environmentLayout.sections?.find(item=>playerX>=item.start&&playerX<item.end);
    this.environmentDebugText.setText(
      `ROOM ${(this.runGraphDepth||0)+1} • ${section?.label||this.environmentLayout.label} • X ${playerX}/${LONG_STAGE_V33.right} • OPEN TRAVERSAL`,
    );
  }
}
