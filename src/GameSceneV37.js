import { GameSceneV36 } from './GameSceneV36.js';
import { ENVIRONMENT_ART_V30 } from './GameSceneV30.js';
import { frameForTerrainMask } from './GameSceneV22.js';
import { TUNING } from './config.js';

const FULL_STONE_FRAME=frameForTerrainMask(0);
const SOUL_COLOR=0x61ff8a;
const SOUL_HOT=0xc8ffd0;

export const SOUL_RELIC_V37=Object.freeze({
  magnetRadius:230,
  collectRadius:30,
  soulGravity:920,
  altarCosts:Object.freeze([6,10]),
  altarSections:Object.freeze([2,5]),
  chestSections:Object.freeze([1,6]),
  eliteSection:6,
  eliteSoulValue:8,
});

export const RELICS_V37=Object.freeze({
  bloodEdge:Object.freeze({id:'bloodEdge',name:'BLOOD EDGE',description:'Every sword strike deals +1 damage.'}),
  greenFlame:Object.freeze({id:'greenFlame',name:'GREEN FLAME',description:'Combo finishers release a short-range soul blade.'}),
  executioner:Object.freeze({id:'executioner',name:'EXECUTIONER',description:'Deal +1 damage to enemies below one-third health.'}),
  phantomStep:Object.freeze({id:'phantomStep',name:'PHANTOM STEP',description:'Dodge recovers 180 ms sooner.'}),
  soulLeech:Object.freeze({id:'soulLeech',name:'SOUL LEECH',description:'Every fifth kill restores 1 HP.'}),
  heavyBlade:Object.freeze({id:'heavyBlade',name:'HEAVY BLADE',description:'The third combo strike deals +1 additional damage.'}),
  relentless:Object.freeze({id:'relentless',name:'RELENTLESS',description:'Every third rapid hit gains +1 damage.'}),
  airCutter:Object.freeze({id:'airCutter',name:'AIR CUTTER',description:'Sword hits made airborne deal +1 damage.'}),
});

const RELIC_IDS=Object.freeze(Object.keys(RELICS_V37));

function hashV37(seed,salt=0){
  let v=((Number(seed)||1)>>>0)^Math.imul((salt+1)>>>0,0x9e3779b1);
  v^=v>>>16;v=Math.imul(v,0x7feb352d);v^=v>>>15;v=Math.imul(v,0x846ca68b);v^=v>>>16;
  return v>>>0;
}

export function relicChoicesV37(seed,slot=0,owned=[]){
  const ownedSet=owned instanceof Set?owned:new Set(owned||[]);
  const available=RELIC_IDS.filter(id=>!ownedSet.has(id));
  if(available.length<=2)return available.map(id=>RELICS_V37[id]);
  const roll=hashV37(seed,slot);
  const first=roll%available.length;
  const second=(first+1+((roll>>>9)%(available.length-1)))%available.length;
  return [RELICS_V37[available[first]],RELICS_V37[available[second]]];
}

function safeFloorSpotV37(layout,section,preferredX){
  const floors=(layout?.floorSegments||[]).filter(spec=>spec.section===section?.id);
  if(!floors.length)return null;
  const direct=floors.find(spec=>preferredX>=spec.x+72&&preferredX<=spec.x+spec.w-72);
  const floor=direct||floors.slice().sort((a,b)=>Math.abs(a.x+a.w*.5-preferredX)-Math.abs(b.x+b.w*.5-preferredX))[0];
  return{x:Math.max(floor.x+80,Math.min(floor.x+floor.w-80,preferredX)),y:floor.y,floor};
}

export class GameSceneV37 extends GameSceneV36 {
  create(){
    this.v37Run={souls:0,relics:new Set(),claimedAltars:new Set(),openedChests:new Set(),kills:0};
    this.v37SoulDrops=[];
    this.v37Altars=[];
    this.v37Chests=[];
    this.v37EliteAura=null;
    this.v37ChoiceActive=false;
    this.v37ChoiceAltar=null;
    this.v37ChoiceOptions=[];
    this.v37ChoiceSelection=0;
    this.v37LastHitAt=-Infinity;
    this.v37RapidHits=0;
    this.v37WaveDamage=false;
    this._v37Pad={left:false,right:false,a:false};
    super.create();
    this.createSoulHudV37();
    this.createRelicChoiceUIV37();
    this.updateSoulHudV37();
  }

  ensureRunStateV37(){
    if(!this.v37Run)this.v37Run={souls:0,relics:new Set(),claimedAltars:new Set(),openedChests:new Set(),kills:0};
    if(!(this.v37Run.relics instanceof Set))this.v37Run.relics=new Set(this.v37Run.relics||[]);
    if(!(this.v37Run.claimedAltars instanceof Set))this.v37Run.claimedAltars=new Set(this.v37Run.claimedAltars||[]);
    if(!(this.v37Run.openedChests instanceof Set))this.v37Run.openedChests=new Set(this.v37Run.openedChests||[]);
    this.v37SoulDrops=this.v37SoulDrops||[];
    return this.v37Run;
  }

  hasRelicV37(id){return this.ensureRunStateV37().relics.has(id);}

  createSoulHudV37(){
    const depth=2100;
    const halo=this.add.circle(28,27,10,SOUL_COLOR,.10).setScrollFactor(0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    const icon=this.add.circle(28,27,4,SOUL_HOT,.92).setScrollFactor(0).setDepth(depth+1);
    const value=this.add.text(44,17,'0',{fontFamily:'system-ui',fontSize:'15px',fontStyle:'bold',color:'#d8ffe0'}).setScrollFactor(0).setDepth(depth+1);
    this.v37SoulHud={halo,icon,value};
    this.scale.on('resize',()=>this.layoutSoulHudV37());
    this.layoutSoulHudV37();
  }

  layoutSoulHudV37(){
    if(!this.v37SoulHud)return;
    const y=Math.max(24,Math.min(34,this.scale.height*.045));
    this.v37SoulHud.halo.setPosition(28,y);this.v37SoulHud.icon.setPosition(28,y);this.v37SoulHud.value.setPosition(44,y-10);
  }

  updateSoulHudV37(){if(this.v37SoulHud?.value)this.v37SoulHud.value.setText(String(this.ensureRunStateV37().souls));}

  createRelicChoiceUIV37(){
    const depth=2200;
    const backdrop=this.add.rectangle(0,0,100,100,0x030509,.965).setOrigin(0).setScrollFactor(0).setDepth(depth).setVisible(false);
    const title=this.add.text(0,0,'BIND A RELIC',{fontFamily:'system-ui',fontSize:'22px',fontStyle:'bold',color:'#eef7ef'}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
    const cost=this.add.text(0,0,'',{fontFamily:'system-ui',fontSize:'11px',fontStyle:'bold',color:'#72ef91'}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
    const cards=[];
    for(let index=0;index<2;index++){
      const bg=this.add.rectangle(0,0,300,170,0x10151d,.99).setStrokeStyle(2,0x52635a,.95).setScrollFactor(0).setDepth(depth+1).setVisible(false).setInteractive({useHandCursor:true});
      const name=this.add.text(0,0,'',{fontFamily:'system-ui',fontSize:'17px',fontStyle:'bold',color:'#f3fff4',align:'center',wordWrap:{width:250}}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      const type=this.add.text(0,0,'RELIC',{fontFamily:'system-ui',fontSize:'10px',fontStyle:'bold',color:'#72ef91'}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      const desc=this.add.text(0,0,'',{fontFamily:'system-ui',fontSize:'12px',color:'#c7d2cb',align:'center',wordWrap:{width:250}}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      bg.on('pointerover',()=>{if(this.v37ChoiceActive){this.v37ChoiceSelection=index;this.refreshRelicSelectionV37();}});
      bg.on('pointerdown',()=>{if(this.v37ChoiceActive)this.chooseRelicV37(index);});
      cards.push({bg,name,type,desc});
    }
    this.v37RelicUI={backdrop,title,cost,cards};
    this.scale.on('resize',()=>this.layoutRelicChoiceUIV37());
  }

  layoutRelicChoiceUIV37(){
    if(!this.v37RelicUI)return;
    const w=this.scale.width,h=this.scale.height;
    this.v37RelicUI.backdrop.setSize(w,h);
    this.v37RelicUI.title.setPosition(w*.5,Math.max(22,h*.10));
    this.v37RelicUI.cost.setPosition(w*.5,Math.max(57,h*.20));
    const cardW=Math.min(330,Math.max(230,w*.34)),cardH=Math.min(178,Math.max(140,h*.46)),y=Math.max(148,h*.58),xs=[w*.30,w*.70];
    this.v37RelicUI.cards.forEach((card,index)=>{
      card.bg.setPosition(xs[index],y).setSize(cardW,cardH);
      card.name.setPosition(xs[index],y-cardH*.5+18).setWordWrapWidth(cardW-34);
      card.type.setPosition(xs[index],y-cardH*.5+51);
      card.desc.setPosition(xs[index],y-cardH*.5+76).setWordWrapWidth(cardW-34);
    });
  }

  setRelicChoiceVisibleV37(visible){
    const ui=this.v37RelicUI;if(!ui)return;
    ui.backdrop.setVisible(visible);ui.title.setVisible(visible);ui.cost.setVisible(visible);
    ui.cards.forEach((card,index)=>{
      const show=visible&&!!this.v37ChoiceOptions[index];
      card.bg.setVisible(show);card.name.setVisible(show);card.type.setVisible(show);card.desc.setVisible(show);
    });
  }

  refreshRelicSelectionV37(){
    if(!this.v37RelicUI)return;
    this.v37RelicUI.cards.forEach((card,index)=>{
      const selected=index===this.v37ChoiceSelection;
      card.bg.setStrokeStyle(selected?4:2,selected?0x74ff96:0x52635a,selected?1:.95);
      card.bg.setFillStyle(selected?0x142119:0x10151d,.99);
      card.name.setScale(selected?1.035:1);
    });
  }

  openRelicChoiceV37(altar){
    if(!altar||this.v37ChoiceActive||this.dead||this.rewardActive||this.routeActive)return;
    const run=this.ensureRunStateV37();
    if(run.claimedAltars.has(altar.key)||run.souls<altar.cost)return;
    const choices=relicChoicesV37(this.environmentLayout?.roomSeed||this.runSeed||1,altar.slot,run.relics);
    if(!choices.length){run.claimedAltars.add(altar.key);altar.claimed=true;return;}
    this.v37ChoiceActive=true;this.v37ChoiceAltar=altar;this.v37ChoiceOptions=choices;this.v37ChoiceSelection=0;
    this.v37ChoiceInputLockUntil=(this.time?.now||0)+180;
    this.physics.pause();this.touchControls?.setVisible(false);
    this.v37RelicUI.cost.setText(`OFFER ${altar.cost} SOUL${altar.cost===1?'':'S'}`);
    choices.forEach((choice,index)=>{const card=this.v37RelicUI.cards[index];card.name.setText(choice.name);card.type.setText('RELIC');card.desc.setText(choice.description);});
    this.setRelicChoiceVisibleV37(true);this.layoutRelicChoiceUIV37();this.refreshRelicSelectionV37();
  }

  chooseRelicV37(index){
    if(!this.v37ChoiceActive||(this.time?.now||0)<(this.v37ChoiceInputLockUntil||0))return;
    const altar=this.v37ChoiceAltar,relic=this.v37ChoiceOptions[index];if(!altar||!relic)return;
    const run=this.ensureRunStateV37();if(run.souls<altar.cost)return;
    run.souls-=altar.cost;run.relics.add(relic.id);run.claimedAltars.add(altar.key);altar.claimed=true;altar.core?.setAlpha?.(.06);
    this.applyRelicV37(relic);
    this.v37ChoiceActive=false;this.v37ChoiceAltar=null;this.v37ChoiceOptions=[];this.setRelicChoiceVisibleV37(false);
    this.touchControls?.setVisible(true);if(!this.dead&&!this.pausePanel?.bg?.visible&&!this.routeActive)this.physics.resume();
    this.updateSoulHudV37();this.spawnGreenBurst?.(this.player.x,this.player.y-18,24,68,52,340);
  }

  handleRelicChoiceInputV37(){
    if(!this.v37ChoiceActive)return;
    const count=Math.max(1,this.v37ChoiceOptions.length);
    const keyboard=this.input.keyboard;
    if(keyboard){
      if(!this._v37Keys)this._v37Keys=keyboard.addKeys({left:'LEFT',right:'RIGHT',left2:'A',right2:'D',select:'ENTER',select2:'SPACE'});
      if(Phaser.Input.Keyboard.JustDown(this._v37Keys.left)||Phaser.Input.Keyboard.JustDown(this._v37Keys.left2)){this.v37ChoiceSelection=(this.v37ChoiceSelection+count-1)%count;this.refreshRelicSelectionV37();}
      if(Phaser.Input.Keyboard.JustDown(this._v37Keys.right)||Phaser.Input.Keyboard.JustDown(this._v37Keys.right2)){this.v37ChoiceSelection=(this.v37ChoiceSelection+1)%count;this.refreshRelicSelectionV37();}
      if(Phaser.Input.Keyboard.JustDown(this._v37Keys.select)||Phaser.Input.Keyboard.JustDown(this._v37Keys.select2))this.chooseRelicV37(this.v37ChoiceSelection);
    }
    const pad=this.inputManager?.getActivePad?.();if(!pad)return;
    const left=this.inputManager.buttonDown(pad,'left',14),right=this.inputManager.buttonDown(pad,'right',15),a=this.inputManager.buttonDown(pad,'A',0);
    if(left&&!this._v37Pad.left){this.v37ChoiceSelection=(this.v37ChoiceSelection+count-1)%count;this.refreshRelicSelectionV37();}
    if(right&&!this._v37Pad.right){this.v37ChoiceSelection=(this.v37ChoiceSelection+1)%count;this.refreshRelicSelectionV37();}
    if(a&&!this._v37Pad.a)this.chooseRelicV37(this.v37ChoiceSelection);
    this._v37Pad={left,right,a};
  }

  applyRelicV37(relic){
    this.runStats=this.runStats||{damage:0,heavyDamage:0,maxHp:TUNING.playerMaxHp};
    if(relic?.id==='bloodEdge')this.runStats.damage=(this.runStats.damage||0)+1;
    if(relic?.id==='heavyBlade')this.runStats.heavyDamage=(this.runStats.heavyDamage||0)+1;
  }

  addAltarV37(layout,slot,sectionIndex){
    const section=layout.sections?.[sectionIndex];if(!section)return;
    const spot=safeFloorSpotV37(layout,section,section.start+(slot===0?1120:430));if(!spot)return;
    const key=`${layout.stageIndex||0}:altar:${slot}`,cost=SOUL_RELIC_V37.altarCosts[slot]||8,claimed=this.ensureRunStateV37().claimedAltars.has(key);
    const pedestal=this.add.tileSprite(spot.x,spot.y-30,68,76,ENVIRONMENT_ART_V30.architecture.key,FULL_STONE_FRAME).setDepth(4).setAlpha(.88);
    const bowl=this.add.ellipse(spot.x,spot.y-69,42,11,0x101814,.94).setStrokeStyle(2,0x6f8575,.8).setDepth(5);
    const core=this.add.circle(spot.x,spot.y-78,9,SOUL_COLOR,claimed ? .05 : .18).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(pedestal);this.addV28Decor(bowl);this.addV28Decor(core);
    this.v37Altars.push({key,slot,cost,x:spot.x,y:spot.y,core,claimed});
  }

  addChestV37(layout,slot,sectionIndex){
    const section=layout.sections?.[sectionIndex];if(!section)return;
    const platform=(layout.platforms||[]).filter(spec=>spec.section===section.id&&spec.role==='upper').sort((a,b)=>a.y-b.y)[0];if(!platform)return;
    const x=Math.round((platform.x+platform.w*.5)/32)*32,y=platform.y,key=`${layout.stageIndex||0}:chest:${slot}`,opened=this.ensureRunStateV37().openedChests.has(key);
    const base=this.add.rectangle(x,y-15,46,25,0x2a2118,.98).setStrokeStyle(2,0x827157,.88).setDepth(6);
    const lid=this.add.rectangle(x,y-31,48,14,0x34281c,.98).setStrokeStyle(2,0x93805f,.88).setDepth(7);
    const latch=this.add.rectangle(x,y-20,7,9,0xb79b63,.9).setDepth(8);
    this.addV28Decor(base);this.addV28Decor(lid);this.addV28Decor(latch);
    if(opened){lid.setAngle(-18).setPosition(x-4,y-40);latch.setVisible(false);}
    this.v37Chests.push({key,slot,x,y,lid,latch,opened,value:slot===0?6:9});
  }

  addWorldRewardsV37(layout){
    this.v37Altars=[];this.v37Chests=[];
    SOUL_RELIC_V37.altarSections.forEach((sectionIndex,slot)=>this.addAltarV37(layout,slot,sectionIndex));
    SOUL_RELIC_V37.chestSections.forEach((sectionIndex,slot)=>this.addChestV37(layout,slot,sectionIndex));
  }

  markEliteV37(layout){
    const section=layout.sections?.[SOUL_RELIC_V37.eliteSection];if(!section)return;
    const center=(section.start+section.end)*.5;
    const enemy=(this.enemies||[]).filter(item=>item?.alive&&item.type!=='boss1').sort((a,b)=>Math.abs((a.sprite?.x||0)-center)-Math.abs((b.sprite?.x||0)-center))[0];
    if(!enemy)return;
    enemy.v37Elite=true;enemy.maxHp=(enemy.maxHp||enemy.hp||TUNING.enemyMaxHp)+2;enemy.hp=(enemy.hp||TUNING.enemyMaxHp)+2;
    if(Number.isFinite(enemy.speed))enemy.speed*=1.12;
    const aura=this.add.ellipse(enemy.sprite.x,enemy.sprite.y+25,72,17,0xc5a76d,.09).setDepth(18).setBlendMode(Phaser.BlendModes.ADD);
    this.addV28Decor(aura);this.v37EliteAura={enemy,aura};
  }

  rebuildRoomLayout(template){
    this.ensureRunStateV37();this.v37Altars=[];this.v37Chests=[];this.v37EliteAura=null;
    super.rebuildRoomLayout(template);
    if(this.v34BossMode||this.environmentLayout?.grammar!=='verticalRuinsExpedition')return;
    this.addWorldRewardsV37(this.environmentLayout);this.markEliteV37(this.environmentLayout);
  }

  spawnSoulDropV37(enemy,amount){
    if(!enemy?.sprite||amount<=0)return;
    const count=Math.max(1,Math.min(6,Math.ceil(amount/2)));let remaining=amount;
    for(let i=0;i<count;i++){
      const value=Math.max(1,Math.ceil(remaining/(count-i)));remaining-=value;
      const halo=this.add.circle(0,0,8,SOUL_COLOR,.11).setBlendMode(Phaser.BlendModes.ADD),core=this.add.circle(0,0,3.2,SOUL_HOT,.96);
      const sprite=this.add.container(enemy.sprite.x+(i-(count-1)*.5)*10,enemy.sprite.y-28,[halo,core]).setDepth(95);
      const angle=-Math.PI*.82+(count===1?0:i/(count-1)*Math.PI*.64),speed=145+i*13;
      this.v37SoulDrops.push({sprite,value,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-105,age:0,collected:false});
    }
  }

  collectSoulV37(drop){
    if(!drop?.sprite?.active)return;
    this.ensureRunStateV37().souls+=drop.value||1;drop.collected=true;drop.sprite.destroy();this.updateSoulHudV37();
  }

  surfaceBelowV37(x,y){
    return [...(this.environmentLayout?.platforms||[]),...(this.environmentLayout?.floorSegments||[])]
      .filter(spec=>x>=spec.x+4&&x<=spec.x+spec.w-4&&spec.y>=y-10).sort((a,b)=>a.y-b.y)[0]||null;
  }

  updateSoulDropsV37(delta){
    const dt=Math.min(34,Math.max(0,Number(delta)||16))/1000,px=this.player?.x||0,py=(this.player?.y||0)-18;
    for(const drop of this.v37SoulDrops||[]){
      if(drop.collected||!drop.sprite?.active)continue;
      drop.age+=dt;const dx=px-drop.sprite.x,dy=py-drop.sprite.y,dist=Math.hypot(dx,dy);
      if(dist<SOUL_RELIC_V37.magnetRadius&&drop.age>.18){const force=(1-dist/SOUL_RELIC_V37.magnetRadius)*1250+360,inv=1/Math.max(1,dist);drop.vx+=dx*inv*force*dt;drop.vy+=dy*inv*force*dt;}else drop.vy+=SOUL_RELIC_V37.soulGravity*dt;
      drop.vx*=Math.pow(.987,dt*60);drop.sprite.x+=drop.vx*dt;drop.sprite.y+=drop.vy*dt;
      const surface=this.surfaceBelowV37(drop.sprite.x,drop.sprite.y);
      if(surface&&drop.vy>0&&drop.sprite.y>=surface.y-7){drop.sprite.y=surface.y-7;drop.vy*=-.34;drop.vx*=.74;if(Math.abs(drop.vy)<28)drop.vy=0;}
      const newDist=Math.hypot(px-drop.sprite.x,py-drop.sprite.y);if(newDist<SOUL_RELIC_V37.collectRadius||drop.sprite.y>840)this.collectSoulV37(drop);
    }
    this.v37SoulDrops=(this.v37SoulDrops||[]).filter(drop=>!drop.collected&&drop.sprite?.active);
  }

  onEnemyKilledV37(enemy){
    if(!enemy||enemy.v37SoulRewarded)return;
    enemy.v37SoulRewarded=true;const run=this.ensureRunStateV37();run.kills++;
    const amount=enemy.type==='boss1'?16:(enemy.v37Elite?SOUL_RELIC_V37.eliteSoulValue:(enemy.type==='enemy2'?3:2));
    this.spawnSoulDropV37(enemy,amount);
    if(this.hasRelicV37('soulLeech')&&run.kills%5===0){
      const maxHp=this.runStats?.maxHp||TUNING.playerMaxHp;this.playerHp=Math.min(maxHp,(this.playerHp||0)+1);
      this.pixelArt?.setTintFill?.(0xbfffc9);this.time.delayedCall(100,()=>this.pixelArt?.clearTint?.());
    }
  }

  emitGreenFlameV37(origin){
    const facing=this.facing<0?-1:1,x=origin?.sprite?.x??this.player.x,y=(origin?.sprite?.y??this.player.y)-24;
    const wave=this.add.ellipse(x+facing*42,y,128,34,0x58ff7c,.18).setDepth(104).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:wave,x:wave.x+facing*180,scaleX:1.35,alpha:0,duration:210,ease:'Quad.easeOut',onComplete:()=>wave.destroy()});
    const targets=(this.enemies||[]).filter(enemy=>enemy?.alive&&enemy!==origin&&Math.sign((enemy.sprite?.x||x)-x)===facing&&Math.abs((enemy.sprite?.x||x)-x)<=235&&Math.abs((enemy.sprite?.y||y)-y)<=120).slice(0,2);
    this.v37WaveDamage=true;try{for(const target of targets)this.damageEnemy(target,0);}finally{this.v37WaveDamage=false;}
  }

  damageEnemy(enemy,step){
    if(!enemy?.alive)return;
    const wasAlive=!!enemy.alive,baseDamage=this.runStats?.damage||0,now=this.time?.now||0;let temporaryBonus=0;
    if(!this.v37WaveDamage){
      if(this.hasRelicV37('executioner')&&enemy.hp<=Math.max(1,(enemy.maxHp||enemy.hp)*.34))temporaryBonus++;
      if(this.hasRelicV37('airCutter')&&!this.player?.body?.blocked?.down)temporaryBonus++;
      if(this.hasRelicV37('relentless')){this.v37RapidHits=now-this.v37LastHitAt<=920?(this.v37RapidHits||0)+1:1;this.v37LastHitAt=now;if(this.v37RapidHits>=3){temporaryBonus++;this.v37RapidHits=0;}}
    }
    if(this.runStats)this.runStats.damage=baseDamage+temporaryBonus;
    super.damageEnemy(enemy,step);
    if(this.runStats)this.runStats.damage=baseDamage;
    if(wasAlive&&!enemy.alive)this.onEnemyKilledV37(enemy);
    if(!this.v37WaveDamage&&this.hasRelicV37('greenFlame')&&step===2)this.emitGreenFlameV37(enemy);
    if(!this.v37WaveDamage&&temporaryBonus>0)this.spawnGreenBurst?.(enemy.sprite?.x||0,(enemy.sprite?.y||0)-24,8,28,24,150);
  }

  startRoll(time,body){super.startRoll(time,body);if(this.hasRelicV37('phantomStep'))this.lastRollAt=time-180;}

  openChestV37(chest){
    if(!chest||chest.opened)return;
    chest.opened=true;this.ensureRunStateV37().openedChests.add(chest.key);chest.lid?.setAngle?.(-18);chest.lid?.setPosition?.(chest.x-4,chest.y-40);chest.latch?.setVisible?.(false);
    this.spawnSoulDropV37({sprite:{x:chest.x,y:chest.y-20}},chest.value);this.spawnGreenBurst?.(chest.x,chest.y-24,12,42,30,210);
  }

  updateWorldRewardsV37(){
    if(this.dead||this.rewardActive||this.routeActive||this.v37ChoiceActive||this.v34BossMode)return;
    const run=this.ensureRunStateV37(),px=this.player?.x||0,py=this.player?.y||0;
    for(const altar of this.v37Altars||[]){
      if(altar.claimed||run.claimedAltars.has(altar.key)){altar.core?.setAlpha?.(.05);continue;}
      const affordable=run.souls>=altar.cost;altar.core?.setAlpha?.(affordable ? .24 : .07);
      if(affordable&&Math.hypot(px-altar.x,py-(altar.y-50))<86){this.openRelicChoiceV37(altar);return;}
    }
    for(const chest of this.v37Chests||[]){if(!chest.opened&&!run.openedChests.has(chest.key)&&Math.hypot(px-chest.x,py-(chest.y-24))<58)this.openChestV37(chest);}
  }

  updateEliteAuraV37(){
    const entry=this.v37EliteAura;if(!entry?.aura)return;
    if(!entry.enemy?.alive){entry.aura.setVisible(false);return;}
    entry.aura.setPosition(entry.enemy.sprite.x,entry.enemy.sprite.y+25);
  }

  // The old three-card room-clear reward screen is retired. Relics now exist
  // in the level itself, so clearing an area flows directly into route choice.
  openReward(roomIndex){
    if(this.dead||this.pendingPostRewardAdvance)return;
    this.rewardActive=false;this.setRewardUIVisible?.(false);
    if((this.runGraphDepth||0)>=4){this.runComplete=true;return;}
    this.pendingPostRewardAdvance=true;
    this.time.delayedCall(280,()=>{
      this.pendingPostRewardAdvance=false;if(this.dead)return;
      if(this.isBranchDepth(this.runGraphDepth))this.openRouteChoice();
      else this.transitionToNextNode(this.singleNextTemplate(this.runGraphDepth));
    });
  }

  update(time,delta){
    if(this.v37ChoiceActive){this.handleRelicChoiceInputV37();this.hidePrototypeTextV35();this.suppressPrototypeGeometryV35();return;}
    super.update(time,delta);
    this.updateSoulDropsV37(delta);this.updateWorldRewardsV37();this.updateEliteAuraV37();this.updateSoulHudV37();
  }
}
