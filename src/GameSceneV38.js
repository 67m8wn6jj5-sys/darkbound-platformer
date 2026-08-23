import { GameSceneV37 } from './GameSceneV37.js';
import { ENVIRONMENT_ART_V30 } from './GameSceneV30.js';
import { frameForTerrainMask } from './GameSceneV22.js';
import { TUNING } from './config.js';

const FULL_STONE_FRAME=frameForTerrainMask(0);
const TILE=32;
const FLOOR_H=96;
const DASH_DAMAGE=.5;
const DASH_HIT_X=58;
const DASH_HIT_Y=56;

export const CATHEDRAL_V38=Object.freeze({
  grammar:'cathedralGraphV38',
  label:'FORSAKEN CATHEDRAL',
  worldWidth:7936,
  worldHeight:2720,
  fallResetY:2660,
  activationRadius:860,
  spaceCount:18,
  totalVerticalRange:2096,
});

const THEME_V38=Object.freeze({
  id:'cathedral-v38',label:'FORSAKEN CATHEDRAL',bg:0x05070c,far:0x101624,mid:0x1a2230,tint:0x9098a7,
});

function slab(x,y,w,section){return{x,y,w,h:FLOOR_H,role:'floor',section};}
function ledge(x,y,w,section,role='route'){return{x,y,w:Math.max(TILE,Math.round(w/TILE)*TILE),h:TILE,role,section};}
function spawn(x,y,minX=x-150,maxX=x+150,kind='ground'){return{x,y,minX,maxX,kind};}
function checkpoint(x,y,space){return{x,y,space};}

export const CATHEDRAL_SPACES_V38=Object.freeze([
  Object.freeze({id:'entry',label:'CATHEDRAL ENTRANCE',start:256,end:1216,style:'entry',bounds:{x:256,y:2080,w:960,h:464},connections:['lower-nave']}),
  Object.freeze({id:'upper-nave',label:'UPPER NAVE',start:1216,end:2304,style:'gallery',bounds:{x:1216,y:1580,w:1088,h:484},connections:['lower-nave','choir-loft']}),
  Object.freeze({id:'choir-loft',label:'CHOIR LOFT',start:2304,end:3072,style:'gallery',bounds:{x:2304,y:1360,w:768,h:480},connections:['upper-nave','bell-lower']}),
  Object.freeze({id:'lower-nave',label:'COLLAPSED NAVE',start:1216,end:3072,style:'crypt',bounds:{x:1216,y:2080,w:1856,h:464},connections:['entry','upper-nave','bell-lower']}),
  Object.freeze({id:'bell-lower',label:'BELL TOWER BASE',start:3072,end:3840,style:'tower',bounds:{x:3072,y:2040,w:768,h:504},connections:['lower-nave','bell-crown']}),
  Object.freeze({id:'bell-crown',label:'BELL TOWER CROWN',start:3072,end:3840,style:'tower',bounds:{x:3072,y:320,w:768,h:384},connections:['bell-lower','high-gallery']}),
  Object.freeze({id:'elite-chapel',label:'BLACK CHAPEL',start:6656,end:7488,style:'crypt',bounds:{x:6656,y:720,w:832,h:432},connections:['sanctuary-bridge','final-belfry']}),
  Object.freeze({id:'high-gallery',label:'HIGH GALLERY',start:1920,end:3072,style:'gallery',bounds:{x:1920,y:320,w:1152,h:384},connections:['bell-crown','secret-chapel','return-gallery']}),
  Object.freeze({id:'secret-chapel',label:'ABANDONED CHAPEL',start:704,end:1920,style:'crypt',bounds:{x:704,y:96,w:1216,h:352},connections:['high-gallery']}),
  Object.freeze({id:'return-gallery',label:'RUINED RETURN',start:2240,end:3840,style:'descent',bounds:{x:2240,y:820,w:1600,h:332},connections:['high-gallery','crossing']}),
  Object.freeze({id:'crossing',label:'CENTRAL CROSSING',start:3840,end:4608,style:'gallery',bounds:{x:3840,y:880,w:768,h:336},connections:['return-gallery','central-shaft']}),
  Object.freeze({id:'central-shaft',label:'CENTRAL SHAFT',start:4608,end:5248,style:'tower',bounds:{x:4608,y:960,w:640,h:1584},connections:['crossing','crypt-entry']}),
  Object.freeze({id:'crypt-entry',label:'CRYPT ANTECHAMBER',start:4608,end:5504,style:'crypt',bounds:{x:4608,y:2080,w:896,h:464},connections:['central-shaft','bone-crypt']}),
  Object.freeze({id:'bone-crypt',label:'BONE CRYPT',start:5504,end:6400,style:'crypt',bounds:{x:5504,y:2080,w:896,h:464},connections:['crypt-entry','reliquary','shortcut-stair']}),
  Object.freeze({id:'reliquary',label:'LOWER RELIQUARY',start:5824,end:6656,style:'crypt',bounds:{x:5824,y:1560,w:832,h:456},connections:['bone-crypt']}),
  Object.freeze({id:'shortcut-stair',label:'BROKEN ASCENT',start:6400,end:7040,style:'rise',bounds:{x:6400,y:1320,w:640,h:1120},connections:['bone-crypt','sanctuary-bridge']}),
  Object.freeze({id:'sanctuary-bridge',label:'SANCTUARY BRIDGE',start:6400,end:7232,style:'gallery',bounds:{x:6400,y:1120,w:832,h:416},connections:['shortcut-stair','elite-chapel']}),
  Object.freeze({id:'final-belfry',label:'FINAL BELFRY',start:7040,end:7680,style:'exit',bounds:{x:7040,y:640,w:640,h:320},connections:['elite-chapel']}),
]);

function buildTowerLedges(){
  const result=[];
  let y=2336;
  for(let i=0;i<17;i++,y-=104){
    const x=i%2===0?3136:3488;
    result.push(ledge(x,y,256,'bell-lower',i>12?'upper':'route'));
  }
  return result;
}

function buildShortcutLedges(){
  const result=[];
  let y=2336;
  for(let i=0;i<9;i++,y-=108){
    const x=i%2===0?6432:6720;
    result.push(ledge(x,y,224,'shortcut-stair',i>5?'upper':'route'));
  }
  return result;
}

function floorAtV38(floors,x,preferredY=Infinity){
  return (floors||[])
    .filter(spec=>x>=spec.x+8&&x<=spec.x+spec.w-8&&spec.y<=preferredY+160)
    .sort((a,b)=>Math.abs(a.y-preferredY)-Math.abs(b.y-preferredY))[0]||null;
}

export function generateCathedralV38(seed=1,templateId='duel'){
  const floors=[
    slab(256,2448,960,'entry'),
    slab(1216,2448,1856,'lower-nave'),
    slab(1216,1968,1088,'upper-nave'),
    slab(2304,1744,768,'choir-loft'),
    slab(3072,2448,768,'bell-lower'),
    slab(3072,608,768,'bell-crown'),
    slab(1920,608,480,'high-gallery'),
    slab(2560,608,512,'high-gallery'),
    slab(704,352,1216,'secret-chapel'),
    slab(2240,1056,1600,'return-gallery'),
    slab(3840,1120,768,'crossing'),
    slab(4608,2448,896,'crypt-entry'),
    slab(5504,2448,896,'bone-crypt'),
    slab(5824,1920,832,'reliquary'),
    slab(6400,1920,640,'shortcut-stair'),
    slab(6400,1440,832,'sanctuary-bridge'),
    slab(6656,1056,832,'elite-chapel'),
    slab(7040,864,640,'final-belfry'),
  ];

  const platforms=[
    // Lower nave -> upper nave branch.
    ledge(1408,2320,256,'lower-nave'),ledge(1568,2208,256,'lower-nave'),ledge(1728,2096,288,'upper-nave'),
    ledge(2016,1888,288,'upper-nave','upper'),
    // Upper nave -> choir loft.
    ledge(2208,1856,256,'upper-nave'),ledge(2400,1664,288,'choir-loft','upper'),ledge(2688,1552,256,'choir-loft','upper'),
    // Tower climb.
    ...buildTowerLedges(),
    // High gallery optional climb into the secret chapel.
    ledge(1744,536,224,'high-gallery'),ledge(1536,464,224,'secret-chapel','upper'),ledge(1312,400,224,'secret-chapel','upper'),
    ledge(992,256,288,'secret-chapel','upper'),
    // Deliberate opening in the high gallery drops to the return route.
    ledge(2320,800,224,'return-gallery'),ledge(2592,928,256,'return-gallery'),
    // Central shaft descent.
    ledge(4664,1328,224,'central-shaft'),ledge(4960,1512,224,'central-shaft'),ledge(4664,1696,224,'central-shaft'),
    ledge(4960,1880,224,'central-shaft'),ledge(4664,2064,224,'central-shaft'),ledge(4960,2248,224,'central-shaft'),
    // Reliquary side climb.
    ledge(5824,2320,224,'bone-crypt'),ledge(6016,2208,224,'reliquary'),ledge(6208,2096,224,'reliquary'),ledge(6336,1984,224,'reliquary','upper'),
    ledge(6032,1712,288,'reliquary','upper'),
    // Crypt -> sanctuary shortcut ascent.
    ...buildShortcutLedges(),
    // Bridge -> elite chapel -> final belfry.
    ledge(6816,1328,256,'sanctuary-bridge'),ledge(6960,1216,256,'elite-chapel'),ledge(7104,1104,256,'elite-chapel'),
    ledge(7040,896,288,'elite-chapel','upper'),ledge(7296,960,224,'final-belfry'),
  ];

  const walls=[
    // Makes the bell crown open to the left; the route returns right on a lower layer.
    {x:3776,y:352,w:64,h:704,role:'wall',section:'bell-crown'},
    // Architectural shaft sides stop the descent reading like open empty space.
    {x:4576,y:1120,w:32,h:1328,role:'wall',section:'central-shaft'},
    {x:5248,y:1120,w:32,h:1328,role:'wall',section:'central-shaft'},
  ];

  const checkpoints=[
    checkpoint(416,2368,'entry'),checkpoint(1504,1888,'upper-nave'),checkpoint(3264,2368,'bell-lower'),checkpoint(3264,528,'bell-crown'),
    checkpoint(2448,976,'return-gallery'),checkpoint(4096,1040,'crossing'),checkpoint(4768,2368,'crypt-entry'),checkpoint(6496,1840,'shortcut-stair'),
    checkpoint(6560,1360,'sanctuary-bridge'),checkpoint(6816,976,'elite-chapel'),
  ];

  const groundSpawns=[
    spawn(864,2368,640,1080),spawn(1536,2368,1312,1800),spawn(2032,1888,1776,2240),spawn(2704,1664,2448,2960),
    spawn(3328,2368,3152,3664),spawn(3408,528,3184,3664),spawn(2816,976,2464,3376),spawn(4192,1040,3984,4480),
    spawn(4864,2368,4672,5312),spawn(5728,2368,5536,6208),spawn(6176,1840,5920,6464),spawn(6640,1360,6464,7008),
    spawn(6976,976,6752,7328),spawn(7424,784,7200,7600),
  ];
  const perchSpawns=[
    spawn(2144,1840,2048,2256,'perch'),spawn(2768,1504,2688,2912,'perch'),spawn(3264,1296,3168,3360,'perch'),
    spawn(3584,880,3504,3696,'perch'),spawn(1216,304,1056,1376,'perch'),spawn(6112,1664,5984,6272,'perch'),
    spawn(7168,848,7072,7296,'perch'),
  ];

  const lights=[
    {asset:0,x:704,y:2446},{asset:1,x:1792,y:1966},{asset:2,x:2752,y:1742},{asset:0,x:3296,y:2446},
    {asset:1,x:3232,y:606},{asset:2,x:2176,y:606},{asset:0,x:1120,y:350},{asset:1,x:3520,y:1054},
    {asset:2,x:4160,y:1118},{asset:0,x:4864,y:2446},{asset:1,x:5792,y:2446},{asset:2,x:6176,y:1918},
    {asset:0,x:6592,y:1438},{asset:1,x:7040,y:1054},{asset:2,x:7488,y:862},
  ];
  const objects=[
    {asset:1,x:1000,y:2446,flipX:false},{asset:4,x:1824,y:1966,flipX:true},{asset:7,x:1264,y:350,flipX:false},
    {asset:9,x:5328,y:2446,flipX:true},{asset:11,x:6912,y:1054,flipX:false},
  ];

  return{
    roomSeed:(((Number(seed)||1)>>>0)^0x38ca7ed1)>>>0,
    grammar:CATHEDRAL_V38.grammar,
    label:CATHEDRAL_V38.label,
    theme:THEME_V38,
    templateId,
    stageIndex:0,
    player:{x:416,y:2368},
    sections:CATHEDRAL_SPACES_V38.map(space=>({...space,bounds:{...space.bounds},connections:[...space.connections]})),
    checkpoints,
    floorSegments:floors,
    platforms,
    walls,
    collision:[...floors,...platforms,...walls],
    groundSpawns,
    perchSpawns,
    lights,
    objects,
    exitX:7520,
    exitY:784,
    worldWidth:CATHEDRAL_V38.worldWidth,
    worldHeight:CATHEDRAL_V38.worldHeight,
    fallResetY:CATHEDRAL_V38.fallResetY,
  };
}

export class GameSceneV38 extends GameSceneV37 {
  create(){
    this.v38AirDashUsed=false;
    this.v38DashHitIds=new Set();
    this.v38CameraY=42;
    super.create();
  }

  isCathedralV38(){return this.environmentLayout?.grammar===CATHEDRAL_V38.grammar;}

  applyCathedralBoundsV38(layout){
    this.worldWidth=layout.worldWidth;
    this.worldHeight=layout.worldHeight;
    this.cameras?.main?.setBounds?.(0,0,layout.worldWidth,layout.worldHeight);
    this.physics?.world?.setBounds?.(0,0,layout.worldWidth,layout.worldHeight+240);
  }

  addCathedralDepthV38(layout){
    for(const [index,space] of layout.sections.entries()){
      const b=space.bounds;
      const recess=this.add.rectangle(b.x+b.w*.5,b.y+b.h*.5,b.w-24,b.h-16,0x020306,.44)
        .setDepth(-1).setScrollFactor(.90,.93);
      this.addV28Decor(recess);
      const alpha=.56+(index%3)*.045;
      for(const x of [b.x+28,b.x+b.w-28]){
        const column=this.add.tileSprite(x,b.y+b.h*.5,48,Math.max(96,b.h),ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME)
          .setDepth(0).setScrollFactor(.94,.96).setAlpha(alpha);
        this.addV28Decor(column);
      }
      const lintel=this.add.tileSprite(b.x+b.w*.5,b.y+24,Math.max(128,b.w-72),48,ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME)
        .setDepth(0).setScrollFactor(.94,.96).setAlpha(alpha*.92);
      this.addV28Decor(lintel);
      if(index%2===0){
        const masonry=this.add.tileSprite(b.x+b.w*.5,b.y+b.h*.58,Math.max(192,b.w*.62),Math.max(96,b.h*.36),ENVIRONMENT_ART_V30.background.key,FULL_STONE_FRAME)
          .setDepth(-.5).setScrollFactor(.92,.95).setAlpha(.28);
        this.addV28Decor(masonry);
      }
    }

    const shaft=this.add.tileSprite(4928,1784,560,1250,ENVIRONMENT_ART_V30.background.key,FULL_STONE_FRAME)
      .setDepth(-.75).setScrollFactor(.94,.97).setAlpha(.34);
    this.addV28Decor(shaft);
  }

  rebuildRoomLayout(template){
    const depth=this.runGraphDepth||0;
    if(template?.id==='boss1'||depth!==0){
      super.rebuildRoomLayout(template);
      return;
    }

    this.ensureRunStateV37();this.v37Altars=[];this.v37Chests=[];this.v37EliteAura=null;
    this.v34BossMode=false;
    this.clearEnvironmentGeometry();
    const layout=generateCathedralV38(this.runSeed||1,template?.id||'duel');
    this.applyCathedralBoundsV38(layout);

    for(const spec of layout.floorSegments)this.addEnvironmentCollider(spec);
    for(const spec of layout.platforms)this.addTraversalCollider(spec);
    for(const spec of layout.walls)this.addEnvironmentCollider(spec);
    this.renderGothicTerrain([...layout.floorSegments,...layout.platforms,...layout.walls]);
    this.addStageDressingV34(layout);
    this.addCathedralDepthV38(layout);

    this.environmentLayout=layout;
    this.v34CheckpointIndex=0;
    this.v34ExitPrompted=false;
    this.placeEnvironmentActors(layout);
    this.addWorldRewardsV37(layout);
    this.markEliteV37(layout);
    this.addTerrainDepthV36(layout);
    this.applyCameraPolishV36();
    this.updateEnvironmentDebugText();
  }

  configureStageActivationV24(){
    if(!this.isCathedralV38())return super.configureStageActivationV24();
    const now=this.time?.now||0;
    for(const [index,enemy] of (this.enemies||[]).entries()){
      if(!enemy?.alive||enemy.type==='boss1')continue;
      enemy.v38Home={x:enemy.sprite?.x||0,y:enemy.sprite?.y||0};
      this.setEnemyDormant(enemy,true);
      if(enemy.sprite?.body)enemy.sprite.body.enable=true;
      enemy.nextAttackAt=now+520+index*65;
    }
    this.updateCheckpointV34();
  }

  updateStageActivationV24(time){
    if(!this.isCathedralV38())return super.updateStageActivationV24(time);
    if(this.dead||this.rewardActive||this.routeActive||!this.player)return;
    for(const enemy of this.enemies||[]){
      if(!enemy?.alive||!enemy.roomDormant||enemy.type==='boss1')continue;
      const home=enemy.v38Home||enemy.sprite;
      const dx=(home?.x||0)-this.player.x,dy=(home?.y||0)-this.player.y;
      if(Math.hypot(dx,dy)<=CATHEDRAL_V38.activationRadius)this.activateTraversalEnemyV33(enemy,time);
    }
  }

  updateCheckpointV34(){
    if(!this.isCathedralV38())return super.updateCheckpointV34();
    const checkpoints=this.environmentLayout?.checkpoints||[];
    if(!this.player||!checkpoints.length)return;
    let best=-1,bestDistance=Infinity;
    checkpoints.forEach((point,index)=>{
      const distance=Math.hypot(this.player.x-point.x,this.player.y-point.y);
      if(distance<bestDistance){bestDistance=distance;best=index;}
    });
    if(best>=0&&bestDistance<=260)this.v34CheckpointIndex=best;
  }

  respawnAtCheckpointV34(){
    if(this.isCathedralV38()&&this.player?.y<=(this.environmentLayout?.fallResetY||CATHEDRAL_V38.fallResetY))return;
    super.respawnAtCheckpointV34();
  }

  startAttack(time,step=null){
    const airborne=!this.player?.body?.blocked?.down;
    super.startAttack(time,step);
    if(!airborne)return;
    this.attackVisualAction='attack_3';
    this.lastVisualAttackAction='attack_3';
    this.setPixelState?.('attack_3',time,true);
    this.lastAttackFxToken='';
  }

  startRoll(time,b){
    const airborne=!b?.blocked?.down;
    super.startRoll(time,b);
    this.v38DashHitIds=new Set();
    if(airborne){
      this.v38AirDashUsed=true;
      b?.setVelocityY?.(0);
    }
  }

  damageEnemyWithDashV38(enemy){
    if(!enemy?.alive||this.v38DashHitIds.has(enemy.id))return;
    this.v38DashHitIds.add(enemy.id);
    const wasAlive=enemy.alive;
    enemy.hp=Math.max(0,(enemy.hp||0)-DASH_DAMAGE);
    enemy.state='stagger';enemy.stateEndsAt=(this.time?.now||0)+90;
    enemy.tell?.setVisible?.(false);
    enemy.sprite?.body?.setVelocity?.(this.facing*120,-32);
    this.tweens?.add?.({targets:enemy.sprite,alpha:.42,yoyo:true,repeat:1,duration:38});
    this.spawnGreenBurst?.(enemy.sprite?.x||0,(enemy.sprite?.y||0)-8,5,18,16,100);
    this.cameras?.main?.shake?.(38,.0018);
    if(enemy.hp<=0){
      this.killEnemy(enemy);
      if(wasAlive&&!enemy.alive)this.onEnemyKilledV37?.(enemy);
    }
    this.updateHud?.();
  }

  updateDashDamageV38(time){
    if(time>=this.rollEndsAt||!this.player)return;
    for(const enemy of this.enemies||[]){
      if(!enemy?.alive||enemy.type==='boss1'&&enemy.invulnerable)continue;
      const dx=Math.abs((enemy.sprite?.x||0)-this.player.x),dy=Math.abs((enemy.sprite?.y||0)-this.player.y);
      if(dx<=DASH_HIT_X&&dy<=DASH_HIT_Y)this.damageEnemyWithDashV38(enemy);
    }
  }

  updateVerticalCameraV38(){
    if(!this.isCathedralV38())return;
    const camera=this.cameras?.main,body=this.player?.body;if(!camera||!body)return;
    const target=42+Math.max(-110,Math.min(150,(body.velocity?.y||0)*.16));
    this.v38CameraY+=(target-this.v38CameraY)*.065;
    camera.followOffset.y=this.v38CameraY;
  }

  update(time,delta){
    const manager=this.inputManager;
    let originalUpdate=null;
    if(!this.v37ChoiceActive&&manager?.update){
      originalUpdate=manager.update;
      const command=originalUpdate.call(manager);
      manager.update=()=>command;
      const body=this.player?.body;
      const grounded=!!body?.blocked?.down;
      if(grounded)this.v38AirDashUsed=false;
      const canDash=time-this.lastRollAt>=TUNING.rollCooldownMs;
      if(command?.dodgePressed&&!grounded&&canDash&&!this.v38AirDashUsed&&!this.dead&&!this.physics?.world?.isPaused){
        this.startRoll(time,body);
      }
    }

    try{super.update(time,delta);}finally{if(originalUpdate)manager.update=originalUpdate;}

    if(this.player?.body?.blocked?.down)this.v38AirDashUsed=false;
    this.updateDashDamageV38(time);
    this.updateVerticalCameraV38();
  }
}
