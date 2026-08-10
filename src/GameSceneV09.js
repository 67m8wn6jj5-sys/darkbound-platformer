import { GameSceneV08 } from './GameSceneV08.js';

const GATE_Y=500;
const GATE_HEIGHT=280;
const ROOM_BANNER_MS=850;

const ROOM_LAYOUT=[
  {id:'room-1',label:'ROOM 1',left:430,right:1050,trigger:470},
  {id:'room-2',label:'ROOM 2',left:1050,right:1800,trigger:1090},
  {id:'room-3',label:'ROOM 3',left:1800,right:2520,trigger:1840}
];

export class GameSceneV09 extends GameSceneV08 {
  create(){
    super.create();

    // The multi-room controller owns progression now, but inherited enemy AI in
    // V07/V08 still checks roomEncounter.state. Keep that compatibility state
    // in combat so active room enemies are allowed to run their normal AI.
    if(this.roomEncounter){
      this.roomEncounter.state='combat';
      this.roomEncounter.enemies=[];
      this.roomEncounter.clearPending=false;
    }

    // Retire the single-room prototype gates.
    for(const gate of Object.values(this.roomGates||{}))gate?.destroy();
    this.roomGates={};

    // Production screen: hide the old engineering/debug readout.
    this.debug?.setVisible(false);

    const enemy1a=this.enemies.find(e=>e.type==='enemy1');
    const enemy1b=this.enemies.find(e=>e.type==='enemy1'&&e!==enemy1a);
    const troll1=this.enemies.find(e=>e.type==='enemy2');

    this.placeEnemy(enemy1a,760,560);
    this.placeEnemy(enemy1b,1330,560);
    this.placeEnemy(troll1,1570,560);

    const enemy1c=this.createEnemy(2070,560,'blade');
    const troll2=this.createEnemy2(2240,560);
    const troll3=this.createEnemy2(2410,560);
    this.enemies.push(enemy1c,troll2,troll3);
    for(const enemy of [enemy1c,troll2,troll3]){
      this.physics.add.collider(enemy.sprite,this.platforms);
    }

    this.progressionGates=new Map();
    const gateXs=[430,1050,1800,2520];
    for(const x of gateXs)this.progressionGates.set(x,this.createProgressionGate(x));

    this.rooms=[
      {...ROOM_LAYOUT[0],state:'inactive',enemies:[enemy1a],clearPending:false},
      {...ROOM_LAYOUT[1],state:'locked',enemies:[enemy1b,troll1],clearPending:false},
      {...ROOM_LAYOUT[2],state:'locked',enemies:[enemy1c,troll2,troll3],clearPending:false}
    ];
    this.activeRoomIndex=-1;
    this.completedRooms=0;
    this.runComplete=false;

    this.rooms.forEach(room=>room.enemies.forEach(enemy=>this.setEnemyDormant(enemy,true)));
    this.refreshProgressionGates();

    this.roomProgressText=this.add.text(this.scale.width-18,18,'ROOM 1 / 3',{
      fontFamily:'system-ui',fontSize:'14px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#080b15cc',padding:{x:10,y:6}
    }).setOrigin(1,0).setScrollFactor(0).setDepth(902);
    this.scale.on('resize',size=>this.roomProgressText?.setPosition(size.width-18,18));
  }

  placeEnemy(enemy,x,y){
    if(!enemy)return;
    enemy.sprite.setPosition(x,y);
    enemy.tell?.setPosition(x,y-10);
    enemy.hpBarBg?.setPosition(x,y-64);
    enemy.hpBar?.setPosition(x-18,y-64);
    if(enemy.type==='enemy1'){
      enemy.patrolMin=x-120;
      enemy.patrolMax=x+120;
      enemy.patrolDir=1;
      enemy.facing=1;
    }
  }

  createProgressionGate(x){
    const gate=this.add.rectangle(x,GATE_Y,24,GATE_HEIGHT,0x5f1726,.92).setStrokeStyle(3,0xff5b72,.9).setDepth(80);
    this.physics.add.existing(gate,true);
    this.physics.add.collider(this.player,gate);
    this.enemies.forEach(enemy=>this.physics.add.collider(enemy.sprite,gate));
    return gate;
  }

  setGateLocked(x,locked){
    const gate=this.progressionGates.get(x);
    if(!gate)return;
    gate.setVisible(locked);
    if(gate.body)gate.body.enable=locked;
    this.tweens.killTweensOf(gate);
    gate.setScale(1,1).setAlpha(.92);
    if(locked)this.tweens.add({targets:gate,alpha:.58,scaleX:1.18,yoyo:true,repeat:-1,duration:260,ease:'Sine.easeInOut'});
  }

  refreshProgressionGates(){
    for(const x of this.progressionGates.keys())this.setGateLocked(x,false);
    if(this.activeRoomIndex>=0){
      const room=this.rooms[this.activeRoomIndex];
      if(room?.state==='combat'){
        this.setGateLocked(room.left,true);
        this.setGateLocked(room.right,true);
      }
    }
    if(!this.runComplete){
      for(let i=this.completedRooms+1;i<this.rooms.length;i++)this.setGateLocked(this.rooms[i].left,true);
      if(this.completedRooms<this.rooms.length)this.setGateLocked(2520,true);
    }
  }

  setEnemyDormant(enemy,dormant){
    if(!enemy)return;
    enemy.roomDormant=dormant;
    if(dormant&&enemy.sprite?.body){
      enemy.sprite.body.setVelocity(0,0);
      enemy.state='dormant';
      enemy.tell?.setVisible(false);
    }
  }

  activateRoom(index,time){
    const room=this.rooms[index];
    if(!room||room.state!=='inactive')return;
    room.state='combat';
    room.activatedAt=time;
    this.activeRoomIndex=index;

    for(const enemy of room.enemies){
      if(!enemy?.alive)continue;
      this.setEnemyDormant(enemy,false);
      if(enemy.sprite?.body)enemy.sprite.body.enable=true;
      enemy.nextAttackAt=time+350;
      if(enemy.type==='enemy2'){
        enemy.state='ranged';
        this.setTrollAnim(enemy,'patrol',time,true);
      }else{
        enemy.state='patrol';
        this.setEnemyAnim(enemy,'patrol',time,true);
      }
    }

    this.refreshProgressionGates();
    this.showRoomBanner(`${room.label} SEALED`,ROOM_BANNER_MS);
    this.cameras.main.shake(90,.0035);
  }

  clearRoom(index,time){
    const room=this.rooms[index];
    if(!room||room.state!=='combat')return;
    room.state='cleared';
    room.clearedAt=time;
    room.clearPending=false;
    this.completedRooms=Math.max(this.completedRooms,index+1);
    this.activeRoomIndex=-1;

    const next=this.rooms[index+1];
    if(next&&next.state==='locked')next.state='inactive';
    if(!next){
      this.runComplete=true;
      this.showRoomBanner('AREA CLEARED',1200);
    }else{
      this.showRoomBanner(`${room.label} CLEARED`,900);
    }
    this.refreshProgressionGates();
    this.cameras.main.shake(120,.0025);
    this.updateProgressText();
  }

  updateProgressText(){
    if(!this.roomProgressText)return;
    if(this.runComplete){this.roomProgressText.setText('AREA COMPLETE');return;}
    const next=Math.min(this.completedRooms+1,this.rooms.length);
    this.roomProgressText.setText(`ROOM ${next} / ${this.rooms.length}`);
  }

  updateMultiRoomProgression(time){
    if(this.runComplete)return;

    if(this.activeRoomIndex<0){
      const index=this.rooms.findIndex(room=>room.state==='inactive'&&this.player.x>=room.trigger&&this.player.x<room.right);
      if(index>=0)this.activateRoom(index,time);
      return;
    }

    const room=this.rooms[this.activeRoomIndex];
    if(!room||room.state!=='combat'||room.clearPending)return;
    if(!room.enemies.every(enemy=>!enemy.alive))return;

    room.clearPending=true;
    const latestDeathEnd=Math.max(time,...room.enemies.map(enemy=>enemy.deathEndsAt||time));
    const delay=Math.max(0,latestDeathEnd-time)+140;
    this.time.delayedCall(delay,()=>{
      const idx=this.rooms.indexOf(room);
      if(idx>=0&&room.state==='combat')this.clearRoom(idx,this.time.now);
    });
  }

  // Disable only the old single-room progression controller. Its combat AI is
  // intentionally left enabled via roomEncounter.state='combat'.
  updateRoomEncounter(){ }

  updateEnemy(enemy,time,index){
    if(enemy?.roomDormant){
      if(enemy.sprite?.body)enemy.sprite.body.setVelocity(0,0);
      enemy.tell?.setVisible(false);
      if(enemy.type==='enemy2'){
        this.setTrollAnim(enemy,'patrol',time);
        this.updateTrollArt(enemy,time);
      }else if(enemy.alive){
        this.setEnemyAnim(enemy,'patrol',time);
        this.updateEnemyArt(enemy,time);
      }
      return;
    }
    super.updateEnemy(enemy,time,index);
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.player)return;
    this.updateMultiRoomProgression(time);
  }
}
