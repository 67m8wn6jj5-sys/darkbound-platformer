import { GameScene } from './GameScene.js';
const config={type:Phaser.AUTO,parent:'game',backgroundColor:'#070910',scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH,width:1280,height:720},physics:{default:'arcade',arcade:{debug:false}},input:{gamepad:true,activePointers:5},scene:[GameScene],render:{antialias:true,pixelArt:false}};
new Phaser.Game(config);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
