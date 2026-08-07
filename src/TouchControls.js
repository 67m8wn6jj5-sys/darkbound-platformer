export class TouchControls {
  constructor(scene, inputManager) {
    this.scene=scene; this.input=inputManager;
    this.items=[];
    this.create();
    scene.scale.on('resize',()=>this.layout());
  }
  makeButton(label, onDown, onUp=()=>{}) {
    const g=this.scene.add.graphics().setScrollFactor(0).setDepth(1000);
    const t=this.scene.add.text(0,0,label,{fontFamily:'system-ui',fontSize:'20px',fontStyle:'bold',color:'#e9edff'}).setOrigin(.5).setScrollFactor(0).setDepth(1001);
    const zone=this.scene.add.zone(0,0,96,96).setOrigin(.5).setScrollFactor(0).setDepth(1002).setInteractive();
    zone.on('pointerdown',p=>{ p.event?.preventDefault?.(); onDown(); g.setAlpha(.95); });
    zone.on('pointerup',()=>{ onUp(); g.setAlpha(.65); }); zone.on('pointerout',()=>{ onUp(); g.setAlpha(.65); });
    const item={g,t,zone,label}; this.items.push(item); return item;
  }
  draw(item,r=34) { item.g.clear().fillStyle(0x1b2340,.65).lineStyle(2,0x7488d8,.9).fillCircle(item.zone.x,item.zone.y,r).strokeCircle(item.zone.x,item.zone.y,r); item.g.setAlpha(.65); item.t.setPosition(item.zone.x,item.zone.y); }
  create() {
    this.left=this.makeButton('◀',()=>this.input.touch.left=true,()=>this.input.touch.left=false);
    this.right=this.makeButton('▶',()=>this.input.touch.right=true,()=>this.input.touch.right=false);
    this.jump=this.makeButton('A',()=>{this.input.touch.jumpPressed=true;this.input.touch.jumpHeld=true;},()=>this.input.touch.jumpHeld=false);
    this.dodge=this.makeButton('B',()=>this.input.touch.dodgePressed=true);
    this.attack=this.makeButton('X',()=>this.input.touch.attackPressed=true);
    this.pause=this.makeButton('Ⅱ',()=>this.scene.togglePause()); this.pause.zone.setSize(70,70);
    this.layout();
  }
  layout() {
    const w=this.scene.scale.width,h=this.scene.scale.height;
    const bottom=h-62, left=72;
    this.left.zone.setPosition(left,bottom); this.right.zone.setPosition(left+88,bottom);
    this.jump.zone.setPosition(w-72,bottom);
    this.dodge.zone.setPosition(w-156,bottom+4);
    this.attack.zone.setPosition(w-240,bottom);
    this.pause.zone.setPosition(w-42,42);
    this.items.forEach(i=>this.draw(i,i===this.pause?24:34));
  }
  setVisible(v){this.items.forEach(i=>{i.g.setVisible(v);i.t.setVisible(v);i.zone.setVisible(v);});}
}
