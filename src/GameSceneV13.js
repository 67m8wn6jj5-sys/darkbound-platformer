import { GameSceneV12 } from './GameSceneV12.js';

const ARENA_LEFT = 430;
const ARENA_RIGHT = 1710;
const ARENA_TRIGGER = 470;
const PLAYER_ENTRY_X = 560;
const PLAYER_ENTRY_Y = 560;
const ROOM_COUNT = 5;
const REWARD_TO_ROUTE_MS = 420;

const TEMPLATES = Object.freeze({
  duel: { id:'duel', name:'DUEL', subtitle:'One close-range hunter', enemies:['enemy1'] },
  hunters: { id:'hunters', name:'HUNTERS', subtitle:'Two melee threats', enemies:['enemy1','enemy1'] },
  mixed: { id:'mixed', name:'MIXED ASSAULT', subtitle:'Melee pressure + sling fire', enemies:['enemy1','enemy2'] },
  crossfire: { id:'crossfire', name:'CROSSFIRE', subtitle:'Two ranged trolls', enemies:['enemy2','enemy2'] },
  pressure: { id:'pressure', name:'PRESSURE', subtitle:'Two hunters + one troll', enemies:['enemy1','enemy1','enemy2'] },
  barrage: { id:'barrage', name:'BARRAGE', subtitle:'One hunter + two trolls', enemies:['enemy1','enemy2','enemy2'] },
  elite: { id:'elite', name:'ELITE GAUNTLET', subtitle:'Final mixed elite encounter', enemies:['enemy1','enemy1','enemy2'], elite:true }
});

const SPAWN_X = [760, 1080, 1410];

export class GameSceneV13 extends GameSceneV12 {
  create(){
    super.create();

    // V12 built three hallway rooms. V13 replaces that structure with a single
    // reusable arena socket and a five-node run graph.
    this.teardownCurrentEnemies();
    this.destroyLegacyProgressionGates();

    this.runGraphDepth = 0;
    this.runHistory = [];
    this.routeActive = false;
    this.routeChoices = [];
    this.routeSelection = 0;
    this.routeInputLockUntil = 0;
    this._routePad = { left:false, right:false, a:false };
    this.pendingPostRewardAdvance = false;

    this.progressionGates = new Map();
    this.progressionGates.set(ARENA_LEFT, this.createProgressionGate(ARENA_LEFT));
    this.progressionGates.set(ARENA_RIGHT, this.createProgressionGate(ARENA_RIGHT));

    this.rooms = [this.makeArenaRoom()];
    this.completedRooms = 0;
    this.activeRoomIndex = -1;
    this.runComplete = false;

    this.createRouteChoiceUI();
    this.loadRunNode(TEMPLATES.duel, 0, false);
    this.updateRunGraphText();
  }

  makeArenaRoom(){
    return {
      id:'arena-node', label:'ROOM 1', left:ARENA_LEFT, right:ARENA_RIGHT,
      trigger:ARENA_TRIGGER, state:'inactive', enemies:[], clearPending:false,
      templateId:null, templateName:null
    };
  }

  teardownCurrentEnemies(){
    for(const projectile of this.enemy2Projectiles || []){
      if(projectile?.sprite?.active) projectile.sprite.destroy();
      if(projectile) projectile.alive=false;
    }
    this.enemy2Projectiles=[];
    for(const enemy of [...(this.enemies||[])]) this.destroyEnemyEntity(enemy);
    this.enemies=[];
    if(this.rooms) this.rooms.forEach(room=>{ room.enemies=[]; });
  }

  destroyLegacyProgressionGates(){
    for(const gate of this.progressionGates?.values?.() || []) gate?.destroy();
    this.progressionGates?.clear?.();
  }

  spawnNodeEnemy(type,x,y,depth,elite=false){
    const enemy = type==='enemy2' ? this.createEnemy2(x,y) : this.createEnemy(x,y,'blade');
    this.physics.add.collider(enemy.sprite,this.platforms);
    const bonusHp = elite ? 1 : (depth>=3 ? 0 : 0);
    if(bonusHp){
      enemy.hp += bonusHp;
      enemy.maxHp = (enemy.maxHp || enemy.hp-bonusHp) + bonusHp;
    }
    if(type==='enemy1') enemy.speed *= elite ? 1.14 : (1 + depth*.025);
    return enemy;
  }

  loadRunNode(template,depth,transition=true){
    this.teardownCurrentEnemies();

    this.runGraphDepth=depth;
    const room=this.rooms[0] || this.makeArenaRoom();
    this.rooms=[room];
    room.label=`ROOM ${depth+1}`;
    room.state='combat';
    room.clearPending=false;
    room.templateId=template.id;
    room.templateName=template.name;
    room.enemies=template.enemies.map((type,i)=>this.spawnNodeEnemy(type,SPAWN_X[i]??SPAWN_X[SPAWN_X.length-1],560,depth,!!template.elite));
    this.enemies=[...room.enemies];

    const now=this.time.now;
    room.enemies.forEach(enemy=>{
      enemy.roomDormant=false;
      if(enemy.sprite?.body) enemy.sprite.body.enable=true;
      enemy.nextAttackAt=now+500;
      if(enemy.type==='enemy2'){
        enemy.state='ranged';
        this.setTrollAnim(enemy,'patrol',now,true);
      }else{
        enemy.state='patrol';
        this.setEnemyAnim(enemy,'patrol',now,true);
      }
    });

    this.activeRoomIndex=0;
    this.completedRooms=depth;
    this.runComplete=false;
    this.setArenaLocked(true);

    this.player.setPosition(PLAYER_ENTRY_X,PLAYER_ENTRY_Y);
    if(this.player.body){
      this.player.body.enable=true;
      this.player.body.setVelocity(0,0);
    }
    this.airJumpsUsed=0;
    this.attackHitIds?.clear?.();
    this.attackEndsAt=-Infinity;
    this.comboExpiresAt=-Infinity;
    this.state='idle';

    this.runHistory[depth]=template;
    this.updateProgressText();
    this.updateRunGraphText();
    this.updateHud();
    this.showRoomBanner(`${room.label} • ${template.name}${template.elite?' • ELITE':''}`,1100);

    if(transition){
      this.cameras.main.fadeIn(180,7,9,16);
      this.cameras.main.shake(80,.002);
    }
  }

  setArenaLocked(locked){
    this.setGateLocked(ARENA_LEFT,locked);
    this.setGateLocked(ARENA_RIGHT,locked);
  }

  // V09/V12 hallway progression is fully replaced by a single active room.
  refreshProgressionGates(){
    if(!this.progressionGates?.size)return;
    const room=this.rooms?.[0];
    this.setArenaLocked(room?.state==='combat' || this.rewardActive || this.routeActive);
  }

  updateMultiRoomProgression(time){
    const room=this.rooms?.[0];
    if(!room || room.state!=='combat' || room.clearPending)return;
    if(!room.enemies.every(enemy=>!enemy.alive))return;

    room.clearPending=true;
    const latestDeathEnd=Math.max(time,...room.enemies.map(enemy=>enemy.deathEndsAt||time));
    const delay=Math.max(0,latestDeathEnd-time)+150;
    this.time.delayedCall(delay,()=>{
      if(room.state==='combat')this.clearRoom(0,this.time.now);
    });
  }

  clearRoom(index,time){
    const room=this.rooms?.[0];
    if(!room || room.state!=='combat')return;
    room.state='cleared';
    room.clearedAt=time;
    room.clearPending=false;
    this.activeRoomIndex=-1;
    this.completedRooms=this.runGraphDepth+1;
    this.setArenaLocked(true);
    this.cameras.main.shake(110,.0025);
    this.updateProgressText();
    this.updateRunGraphText();

    if(this.runGraphDepth>=ROOM_COUNT-1){
      this.runComplete=true;
      this.showRoomBanner('RUN COMPLETE',1400);
    }else{
      this.showRoomBanner(`${room.label} CLEARED`,850);
    }

    this.time.delayedCall(420,()=>this.openReward(this.runGraphDepth));
  }

  updateProgressText(){
    if(!this.roomProgressText)return;
    if(this.runComplete){
      this.roomProgressText.setText('RUN COMPLETE');
      return;
    }
    this.roomProgressText.setText(`ROOM ${Math.min(this.runGraphDepth+1,ROOM_COUNT)} / ${ROOM_COUNT}`);
  }

  chooseReward(index){
    if(!this.rewardActive)return;
    super.chooseReward(index);
    if(this.rewardActive)return;

    if(this.runGraphDepth>=ROOM_COUNT-1){
      this.runComplete=true;
      this.showRoomBanner('RUN COMPLETE',1400);
      this.updateProgressText();
      return;
    }

    if(this.pendingPostRewardAdvance)return;
    this.pendingPostRewardAdvance=true;
    this.time.delayedCall(REWARD_TO_ROUTE_MS,()=>{
      this.pendingPostRewardAdvance=false;
      if(this.dead)return;
      if(this.isBranchDepth(this.runGraphDepth)) this.openRouteChoice();
      else this.transitionToNextNode(this.singleNextTemplate(this.runGraphDepth));
    });
  }

  isBranchDepth(depth){ return depth===0 || depth===2; }

  singleNextTemplate(depth){
    if(depth===1) return Phaser.Utils.Array.GetRandom([TEMPLATES.mixed,TEMPLATES.hunters,TEMPLATES.crossfire]);
    if(depth===3) return TEMPLATES.elite;
    return TEMPLATES.mixed;
  }

  branchOptions(depth){
    if(depth===0){
      const left=Phaser.Utils.Array.GetRandom([TEMPLATES.hunters,TEMPLATES.mixed]);
      const right=left.id==='hunters'?TEMPLATES.crossfire:Phaser.Utils.Array.GetRandom([TEMPLATES.hunters,TEMPLATES.crossfire]);
      return [left,right];
    }
    const pool=[TEMPLATES.pressure,TEMPLATES.barrage,TEMPLATES.crossfire];
    const first=Phaser.Utils.Array.GetRandom(pool);
    const second=Phaser.Utils.Array.GetRandom(pool.filter(t=>t.id!==first.id));
    return [first,second];
  }

  createRouteChoiceUI(){
    const depth=1900;
    const backdrop=this.add.rectangle(0,0,100,100,0x05070d,.95).setOrigin(0).setScrollFactor(0).setDepth(depth).setVisible(false);
    const title=this.add.text(0,0,'CHOOSE YOUR PATH',{fontFamily:'system-ui',fontSize:'23px',fontStyle:'bold',color:'#ffffff'}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
    const subtitle=this.add.text(0,0,'Tap a route • D-pad/← → + A/Enter',{fontFamily:'system-ui',fontSize:'11px',color:'#aeb8cc'}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
    const cards=[];
    for(let i=0;i<2;i++){
      const bg=this.add.rectangle(0,0,270,150,0x101727,.98).setStrokeStyle(2,0x54627d,1).setScrollFactor(0).setDepth(depth+1).setVisible(false).setInteractive({useHandCursor:true});
      const name=this.add.text(0,0,'',{fontFamily:'system-ui',fontSize:'17px',fontStyle:'bold',color:'#ffffff',align:'center',wordWrap:{width:235}}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      const type=this.add.text(0,0,'COMBAT',{fontFamily:'system-ui',fontSize:'10px',fontStyle:'bold',color:'#71ff8a'}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      const desc=this.add.text(0,0,'',{fontFamily:'system-ui',fontSize:'11px',color:'#cbd3e4',align:'center',wordWrap:{width:235}}).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      bg.on('pointerover',()=>{if(this.routeActive){this.routeSelection=i;this.refreshRouteSelection();}});
      bg.on('pointerdown',()=>{if(this.routeActive)this.chooseRoute(i);});
      cards.push({bg,name,type,desc});
    }
    this.routeUI={backdrop,title,subtitle,cards};
    this.scale.on('resize',()=>this.layoutRouteUI());
  }

  layoutRouteUI(){
    if(!this.routeUI)return;
    const w=this.scale.width,h=this.scale.height;
    const cardW=Math.min(300,Math.max(210,w*.34));
    const cardH=Math.min(165,Math.max(126,h*.52));
    const y=Math.max(120,h*.57);
    this.routeUI.backdrop.setSize(w,h);
    this.routeUI.title.setPosition(w/2,Math.max(18,h*.10));
    this.routeUI.subtitle.setPosition(w/2,Math.max(50,h*.22));
    const xs=[w*.31,w*.69];
    this.routeUI.cards.forEach((card,i)=>{
      card.bg.setPosition(xs[i],y).setSize(cardW,cardH);
      card.name.setPosition(xs[i],y-cardH/2+17).setWordWrapWidth(cardW-28);
      card.type.setPosition(xs[i],y-cardH/2+48);
      card.desc.setPosition(xs[i],y-cardH/2+70).setWordWrapWidth(cardW-28);
    });
  }

  setRouteUIVisible(visible){
    if(!this.routeUI)return;
    this.routeUI.backdrop.setVisible(visible);
    this.routeUI.title.setVisible(visible);
    this.routeUI.subtitle.setVisible(visible);
    this.routeUI.cards.forEach(card=>{
      card.bg.setVisible(visible); card.name.setVisible(visible); card.type.setVisible(visible); card.desc.setVisible(visible);
    });
  }

  openRouteChoice(){
    if(this.routeActive||this.dead)return;
    this.routeActive=true;
    this.routeSelection=0;
    this.routeChoices=this.branchOptions(this.runGraphDepth);
    this.routeInputLockUntil=this.time.now+180;
    this.physics.pause();
    this.touchControls?.setVisible(false);
    this.setRouteUIVisible(true);
    this.layoutRouteUI();
    this.routeChoices.forEach((choice,i)=>{
      const card=this.routeUI.cards[i];
      card.name.setText(choice.name);
      card.type.setText(choice.elite?'ELITE COMBAT':'COMBAT');
      card.desc.setText(choice.subtitle);
    });
    this.refreshRouteSelection();
  }

  refreshRouteSelection(){
    if(!this.routeUI)return;
    this.routeUI.cards.forEach((card,i)=>{
      const selected=i===this.routeSelection;
      card.bg.setStrokeStyle(selected?4:2,selected?0x68ff83:0x54627d,1);
      card.bg.setFillStyle(selected?0x15261d:0x101727,.98);
      card.name.setScale(selected?1.04:1);
    });
  }

  handleRouteInput(){
    if(!this.routeActive)return;
    const keyboard=this.input.keyboard;
    if(keyboard){
      if(!this._routeKeys)this._routeKeys=keyboard.addKeys({left:'LEFT',right:'RIGHT',left2:'A',right2:'D',select:'ENTER',select2:'SPACE'});
      if(Phaser.Input.Keyboard.JustDown(this._routeKeys.left)||Phaser.Input.Keyboard.JustDown(this._routeKeys.left2)){this.routeSelection=(this.routeSelection+1)%2;this.refreshRouteSelection();}
      if(Phaser.Input.Keyboard.JustDown(this._routeKeys.right)||Phaser.Input.Keyboard.JustDown(this._routeKeys.right2)){this.routeSelection=(this.routeSelection+1)%2;this.refreshRouteSelection();}
      if(Phaser.Input.Keyboard.JustDown(this._routeKeys.select)||Phaser.Input.Keyboard.JustDown(this._routeKeys.select2))this.chooseRoute(this.routeSelection);
    }
    const pad=this.inputManager?.getActivePad?.();
    if(!pad)return;
    const left=this.inputManager.buttonDown(pad,'left',14);
    const right=this.inputManager.buttonDown(pad,'right',15);
    const a=this.inputManager.buttonDown(pad,'A',0);
    if((left&&!this._routePad.left)||(right&&!this._routePad.right)){this.routeSelection=(this.routeSelection+1)%2;this.refreshRouteSelection();}
    if(a&&!this._routePad.a)this.chooseRoute(this.routeSelection);
    this._routePad={left,right,a};
  }

  chooseRoute(index){
    if(!this.routeActive||this.time.now<this.routeInputLockUntil)return;
    const choice=this.routeChoices[index];
    if(!choice)return;
    this.routeActive=false;
    this.setRouteUIVisible(false);
    this.transitionToNextNode(choice);
  }

  transitionToNextNode(template){
    if(!template||this.dead)return;
    this.physics.pause();
    this.touchControls?.setVisible(false);
    this.cameras.main.fadeOut(180,5,7,13);
    this.cameras.main.once('camerafadeoutcomplete',()=>{
      this.loadRunNode(template,this.runGraphDepth+1,true);
      this.touchControls?.setVisible(true);
      if(!this.dead&&!this.pausePanel?.bg?.visible)this.physics.resume();
    });
  }

  updateRunGraphText(){
    if(!this.runRouteText)return;
    const path=[];
    for(let i=0;i<ROOM_COUNT;i++){
      const template=this.runHistory?.[i];
      if(i<this.runGraphDepth) path.push(`✓ ${template?.name||'ROOM'}`);
      else if(i===this.runGraphDepth) path.push(`▶ ${template?.name||'?'}`);
      else path.push('• ?');
    }
    this.runRouteText.setText(path.join('   '));
  }

  updateRunRouteText(){ this.updateRunGraphText(); }

  update(time,delta){
    if(this.routeActive){
      this.handleRouteInput();
      return;
    }
    super.update(time,delta);
    if(!this.rewardActive&&!this.routeActive)this.updateRunGraphText();
  }
}
