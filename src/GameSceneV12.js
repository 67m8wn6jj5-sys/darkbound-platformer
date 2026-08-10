import { GameSceneV11 } from './GameSceneV11.js';

const ROOM_TEMPLATES = Object.freeze([
  { id:'duel', name:'DUEL', threat:1, enemies:[{type:'enemy1'}] },
  { id:'hunters', name:'HUNTERS', threat:2, enemies:[{type:'enemy1'},{type:'enemy1'}] },
  { id:'mixed', name:'MIXED ASSAULT', threat:2, enemies:[{type:'enemy1'},{type:'enemy2'}] },
  { id:'crossfire', name:'CROSSFIRE', threat:2, enemies:[{type:'enemy2'},{type:'enemy2'}] },
  { id:'pressure', name:'PRESSURE', threat:3, enemies:[{type:'enemy1'},{type:'enemy1'},{type:'enemy2'}] },
  { id:'barrage', name:'BARRAGE', threat:3, enemies:[{type:'enemy1'},{type:'enemy2'},{type:'enemy2'}] }
]);

const ROOM_SLOT_SPAWNS = [
  [760, 900, 620],
  [1320, 1510, 1660],
  [2020, 2200, 2390]
];

export class GameSceneV12 extends GameSceneV11 {
  create(){
    super.create();

    this.runSeed = (Date.now() ^ Math.floor(Math.random()*0x7fffffff)) >>> 0;
    this.runRoute = [];
    this.rebuildProceduralRooms();

    this.runRouteText = this.add.text(18,18,'',{
      fontFamily:'system-ui',fontSize:'11px',fontStyle:'bold',color:'#b9c6de',backgroundColor:'#080b15aa',padding:{x:8,y:5}
    }).setScrollFactor(0).setDepth(903);
    this.updateRunRouteText();
  }

  destroyEnemyEntity(enemy){
    if(!enemy)return;
    enemy.tell?.destroy();
    enemy.hpBar?.destroy();
    enemy.hpBarBg?.destroy();
    enemy.sprite?.destroy();
  }

  chooseTemplate(slotIndex, usedIds){
    const maxThreat = slotIndex===0 ? 1 : slotIndex===1 ? 2 : 3;
    let pool = ROOM_TEMPLATES.filter(t=>t.threat<=maxThreat && !usedIds.has(t.id));
    if(!pool.length)pool=ROOM_TEMPLATES.filter(t=>t.threat<=maxThreat);
    return Phaser.Utils.Array.GetRandom(pool);
  }

  spawnProceduralEnemy(type,x,y){
    const enemy = type==='enemy2' ? this.createEnemy2(x,y) : this.createEnemy(x,y,'blade');
    this.physics.add.collider(enemy.sprite,this.platforms);
    return enemy;
  }

  rebuildProceduralRooms(){
    const oldEnemies=[...(this.enemies||[])];
    oldEnemies.forEach(enemy=>this.destroyEnemyEntity(enemy));
    this.enemies=[];

    const usedIds=new Set();
    const templates=[];
    for(let i=0;i<this.rooms.length;i++){
      const template=this.chooseTemplate(i,usedIds);
      templates.push(template);
      usedIds.add(template.id);
    }

    this.rooms.forEach((room,index)=>{
      const template=templates[index];
      const xs=ROOM_SLOT_SPAWNS[index];
      const enemies=template.enemies.map((spec,i)=>this.spawnProceduralEnemy(spec.type,xs[i]??xs[xs.length-1],560));
      enemies.forEach(enemy=>this.setEnemyDormant(enemy,true));
      room.enemies=enemies;
      room.templateId=template.id;
      room.templateName=template.name;
      room.threat=template.threat;
      room.state=index===0?'inactive':'locked';
      room.clearPending=false;
      this.enemies.push(...enemies);
      this.runRoute.push(template);
    });

    this.completedRooms=0;
    this.activeRoomIndex=-1;
    this.runComplete=false;
    this.refreshProgressionGates();
    this.updateProgressText();
  }

  activateRoom(index,time){
    super.activateRoom(index,time);
    const room=this.rooms?.[index];
    if(room?.state==='combat'){
      this.showRoomBanner(`${room.label} • ${room.templateName}`,950);
      this.updateRunRouteText();
    }
  }

  clearRoom(index,time){
    super.clearRoom(index,time);
    this.updateRunRouteText();
  }

  updateRunRouteText(){
    if(!this.runRouteText)return;
    const route=this.runRoute.map((template,i)=>{
      const room=this.rooms?.[i];
      const marker=room?.state==='cleared'?'✓':room?.state==='combat'?'▶':'•';
      return `${marker} ${i+1}:${template.name}`;
    }).join('   ');
    this.runRouteText.setText(route);
  }

  updateHud(){
    super.updateHud();
    if(this.hud?.text && !this.hud.text.includes('RUN')){
      this.hud.setText(`${this.hud.text}   •   RUN ${String(this.runSeed??0).slice(-4)}`);
    }
  }

  update(time,delta){
    super.update(time,delta);
    if(!this.rewardActive)this.updateRunRouteText();
  }
}
