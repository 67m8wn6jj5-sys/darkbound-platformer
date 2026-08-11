import { GameSceneV13 } from './GameSceneV13.js';

const ROOM_LAYOUTS = Object.freeze({
  duel: {
    name:'FLAT DUEL',
    player:{x:560,y:560},
    platforms:[
      {x:760,y:515,w:220,h:24},
      {x:1210,y:515,w:220,h:24}
    ],
    spawns:[{x:1110,y:560},{x:1370,y:560},{x:1480,y:560}]
  },
  hunters: {
    name:'SPLIT LEVEL',
    player:{x:560,y:560},
    platforms:[
      {x:690,y:500,w:270,h:24},
      {x:1110,y:420,w:250,h:24},
      {x:1390,y:520,w:210,h:24}
    ],
    spawns:[{x:940,y:560},{x:1330,y:380},{x:1500,y:560}]
  },
  mixed: {
    name:'CENTRAL TOWER',
    player:{x:560,y:560},
    platforms:[
      {x:820,y:520,w:220,h:24},
      {x:1035,y:425,w:220,h:24},
      {x:1250,y:330,w:220,h:24},
      {x:1420,y:520,w:190,h:24}
    ],
    spawns:[{x:930,y:560},{x:1360,y:290},{x:1490,y:560}]
  },
  crossfire: {
    name:'CROSSFIRE PERCHES',
    player:{x:560,y:560},
    platforms:[
      {x:690,y:465,w:250,h:24},
      {x:1120,y:360,w:250,h:24},
      {x:1430,y:465,w:180,h:24}
    ],
    spawns:[{x:820,y:425},{x:1245,y:320},{x:1510,y:425}]
  },
  pressure: {
    name:'STAGGERED ASCENT',
    player:{x:560,y:560},
    platforms:[
      {x:690,y:535,w:210,h:24},
      {x:920,y:460,w:210,h:24},
      {x:1150,y:385,w:210,h:24},
      {x:1380,y:310,w:210,h:24}
    ],
    spawns:[{x:820,y:495},{x:1050,y:420},{x:1490,y:270}]
  },
  barrage: {
    name:'BROKEN BRIDGE',
    player:{x:560,y:560},
    platforms:[
      {x:700,y:500,w:180,h:24},
      {x:930,y:430,w:150,h:24},
      {x:1150,y:500,w:180,h:24},
      {x:1390,y:410,w:200,h:24}
    ],
    spawns:[{x:820,y:460},{x:1230,y:460},{x:1490,y:370}]
  },
  elite: {
    name:'ELITE GAUNTLET',
    player:{x:560,y:560},
    platforms:[
      {x:660,y:520,w:180,h:24},
      {x:890,y:405,w:220,h:24},
      {x:1160,y:315,w:220,h:24},
      {x:1430,y:445,w:180,h:24}
    ],
    spawns:[{x:790,y:480},{x:1030,y:365},{x:1510,y:405}]
  }
});

export class GameSceneV14 extends GameSceneV13 {
  create(){
    this.dynamicRoomPlatforms=[];
    this.dynamicRoomDecor=[];
    super.create();
    this.rebuildRoomLayout(this.runHistory?.[this.runGraphDepth] || {id:'duel'});
    if(this.runRouteText) this.runRouteText.setVisible(false);
  }

  clearDynamicRoomLayout(){
    for(const platform of this.dynamicRoomPlatforms||[]){
      try { this.platforms?.remove?.(platform); } catch(_) {}
      platform?.destroy?.();
    }
    this.dynamicRoomPlatforms=[];
    for(const item of this.dynamicRoomDecor||[]) item?.destroy?.();
    this.dynamicRoomDecor=[];
  }

  addRoomPlatform(spec){
    const platform=this.add.rectangle(spec.x+spec.w/2,spec.y+spec.h/2,spec.w,spec.h,0x2f3650)
      .setStrokeStyle(2,0x65739c,.95)
      .setDepth(8);
    this.physics.add.existing(platform,true);
    this.platforms.add(platform);
    this.dynamicRoomPlatforms.push(platform);
    return platform;
  }

  roomLayoutFor(template){
    return ROOM_LAYOUTS[template?.id] || ROOM_LAYOUTS.duel;
  }

  rebuildRoomLayout(template){
    this.clearDynamicRoomLayout();
    const layout=this.roomLayoutFor(template);

    for(const spec of layout.platforms) this.addRoomPlatform(spec);

    const label=this.add.text(1070,125,layout.name,{
      fontFamily:'system-ui',fontSize:'18px',fontStyle:'bold',color:'#8190b3',alpha:.34
    }).setOrigin(.5).setDepth(4);
    this.dynamicRoomDecor.push(label);

    const room=this.rooms?.[0];
    const enemies=room?.enemies||[];
    enemies.forEach((enemy,i)=>{
      const spawn=layout.spawns[i]||layout.spawns[layout.spawns.length-1];
      enemy.sprite?.setPosition(spawn.x,spawn.y);
      enemy.tell?.setPosition(spawn.x,spawn.y-10);
      enemy.hpBarBg?.setPosition(spawn.x,spawn.y-64);
      enemy.hpBar?.setPosition(spawn.x-18,spawn.y-64);
      if(enemy.type==='enemy1'){
        enemy.patrolMin=spawn.x-95;
        enemy.patrolMax=spawn.x+95;
      }
    });

    this.player?.setPosition(layout.player.x,layout.player.y);
    if(this.player?.body){
      this.player.body.setVelocity(0,0);
      this.player.body.updateFromGameObject?.();
    }

    this.cameras.main.shake(70,.0015);
  }

  loadRunNode(template,depth,transition=true){
    super.loadRunNode(template,depth,transition);
    this.rebuildRoomLayout(template);
    this.showRoomBanner(`ROOM ${depth+1} • ${template.name} • ${this.roomLayoutFor(template).name}`,1150);
  }

  updateRunGraphText(){
    super.updateRunGraphText?.();
    if(this.runGraphText){
      const template=this.runHistory?.[this.runGraphDepth];
      const layout=this.roomLayoutFor(template);
      this.runGraphText.setText(`${this.runGraphText.text}\nLAYOUT: ${layout.name}`);
    }
  }
}
