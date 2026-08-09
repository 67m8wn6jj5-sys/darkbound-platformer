import { GameScene } from './GameScene.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const FALLBACK_ASSET_ROOT = './assets/v05/production58';
const PIXELLAB_ROOT = './assets/v05/pixellab_protagonist';
const ART_SCALE = 0.38;
const PIXELLAB_SCALE = 1.0;
const PIXELLAB_ART_Y = 72;
const ATTACK_LUNGE = [90,115,145];
const ATTACK_RECOIL = [28,36,48];
const VFX_GREEN = 0x54ff63;
const VFX_GREEN_HOT = 0xcaffaa;
const VFX_GREEN_CORE = 0xeeffd8;

const LOOP_FPS = Object.freeze({idle:8,run:14});
const ONESHOT_FPS = Object.freeze({jump:12,fall:12,light_attack:18,heavy_attack:16,dash:18,hit:16,death:10});
const FALLBACK_SEQUENCES = Object.freeze({idle:{folder:'idle',frames:6},run:{folder:'run',frames:6},jump:{folder:'jump',frames:4},attack:{folder:'attack',frames:8},roll:{folder:'dodge',frames:8},hit:{folder:'hurt',frames:7},death:{folder:'death',frames:8}});
function fallbackKey(name,index){return `fallback-${name}-${String(index+1).padStart(2,'0')}`;}
function pxKey(action,direction,index){return `px-${action}-${direction}-${String(index).padStart(3,'0')}`;}

export class GameSceneV05 extends GameScene {
  preload(){
    for(const [name,sequence] of Object.entries(FALLBACK_SEQUENCES))for(let i=0;i<sequence.frames;i++){const file=`${sequence.folder}_${String(i+1).padStart(2,'0')}.png`;this.load.image(fallbackKey(name,i),`${FALLBACK_ASSET_ROOT}/${sequence.folder}/${file}?v=approved-r2`);}
    for(const [action,directions] of Object.entries(PIXELLAB_MANIFEST))for(const direction of ['east','west']){const count=directions[direction]||0;for(let i=0;i<count;i++){const file=`frame_${String(i).padStart(3,'0')}.png`;this.load.image(pxKey(action,direction,i),`${PIXELLAB_ROOT}/${action}/${direction}/${file}?v=pixellab-protagonist-2`);}}
  }
  create(){
    super.create(); this.hitAnimStartsAt=-Infinity;this.hitAnimEndsAt=-Infinity;this.deathAnimStartsAt=-Infinity;this.pixelState='idle';this.pixelStateStartedAt=this.time.now;this.pixelDirection='east';this.currentPixelKey='';this.attackFlash.setAlpha(0);this.attackArc.setVisible(false);this.player.art.setVisible(false);
    this.pixelArt=this.add.image(this.player.x,this.player.y+PIXELLAB_ART_Y,pxKey('idle','east',0)).setOrigin(.5,1).setScale(PIXELLAB_SCALE).setDepth(100);
    this.fxWasGrounded=!!this.player?.body?.blocked?.down;this.nextDashTrailAt=0;
  }
  createPlayer(x,y){const p=this.add.container(x,y);const shadow=this.add.ellipse(0,25,48,11,0x000000,.44);const aura=this.add.ellipse(0,4,48,82,VFX_GREEN,.035).setStrokeStyle(2,VFX_GREEN_HOT,.14);const art=this.add.image(0,27,fallbackKey('idle',0)).setOrigin(.5,1).setScale(ART_SCALE).setAlpha(1);const weaponProxy=this.add.rectangle(16,0,54,8,0xffffff,0).setOrigin(.08,.5);p.add([shadow,aura,art,weaponProxy]);p.art=art;p.aura=aura;p.weapon=weaponProxy;p.cape={setScale(){return this;}};this.physics.add.existing(p);p.body.setSize(28,54).setOffset(-14,-30).setCollideWorldBounds(true).setMaxVelocity(TUNING.rollSpeed,TUNING.maxFallSpeed);return p;}
  setPixelState(name,time,force=false){if(!PIXELLAB_MANIFEST[name])return;if(!force&&this.pixelState===name)return;this.pixelState=name;this.pixelStateStartedAt=time;this.currentPixelKey='';}
  resolvePixelState(time){const body=this.player?.body;if(!body)return'idle';if(this.dead)return'death';if(time<this.hitAnimEndsAt)return'hit';if(this.state==='rolling')return'dash';if(this.state?.startsWith('attack-'))return this.comboStep===2?'heavy_attack':'light_attack';if(!body.blocked.down)return body.velocity.y<0?'jump':'fall';if(this.state==='running')return'run';return'idle';}
  frameForState(action,direction,time){const count=PIXELLAB_MANIFEST[action]?.[direction]||1;const elapsed=Math.max(0,time-this.pixelStateStartedAt);if(LOOP_FPS[action])return Math.floor(elapsed/1000*LOOP_FPS[action])%count;const fps=ONESHOT_FPS[action]||12;return Math.min(count-1,Math.floor(elapsed/1000*fps));}
  updatePixelArt(time){if(!this.pixelArt)return;const action=this.resolvePixelState(time);this.setPixelState(action,time);const direction=this.facing<0?'west':'east';if(direction!==this.pixelDirection){this.pixelDirection=direction;this.currentPixelKey='';}const frame=this.frameForState(action,direction,time);const key=pxKey(action,direction,frame);if(key!==this.currentPixelKey){this.pixelArt.setTexture(key);this.currentPixelKey=key;}this.pixelArt.setPosition(this.player.x,this.player.y+PIXELLAB_ART_Y).setOrigin(.5,1).setScale(PIXELLAB_SCALE).setVisible(true);this.player.art.setVisible(false);}
  spawnGreenBurst(x,y,count=12,spreadX=54,spreadY=38,life=230){for(let i=0;i<count;i++){const size=Phaser.Math.Between(2,6);const color=i%5===0?VFX_GREEN_CORE:(i%2===0?VFX_GREEN_HOT:VFX_GREEN);const p=this.add.circle(x,y,size,color,.95).setDepth(115).setBlendMode(Phaser.BlendModes.ADD);const dx=Phaser.Math.Between(-spreadX,spreadX),dy=Phaser.Math.Between(-spreadY,Math.max(5,Math.floor(spreadY*.4)));this.tweens.add({targets:p,x:x+dx,y:y+dy,scale:.08,alpha:0,duration:Phaser.Math.Between(Math.max(110,life-50),life+90),ease:'Quad.easeOut',onComplete:()=>p.destroy()});}}
  spawnSwordFlare(step=0){const heavy=step===2,x=this.player.x+this.facing*(heavy?48:38),y=this.player.y+PIXELLAB_ART_Y-46,length=heavy?125:82;const glow=this.add.rectangle(x,y,length,heavy?16:10,VFX_GREEN,.42).setOrigin(this.facing>0?0:.99,.5).setAngle(this.facing>0?-24:24).setDepth(108).setBlendMode(Phaser.BlendModes.ADD);const core=this.add.rectangle(x,y,length*.88,heavy?7:5,VFX_GREEN_CORE,.95).setOrigin(this.facing>0?0:.99,.5).setAngle(this.facing>0?-24:24).setDepth(110).setBlendMode(Phaser.BlendModes.ADD);for(const flare of [glow,core])this.tweens.add({targets:flare,scaleX:heavy?1.5:1.35,scaleY:.12,alpha:0,duration:heavy?260:165,ease:'Quad.easeOut',onComplete:()=>flare.destroy()});this.spawnGreenBurst(x+this.facing*(heavy?62:40),y,heavy?22:12,heavy?68:42,heavy?48:30,heavy?330:220);}
  spawnDashTrail(){const x=this.player.x-this.facing*18,y=this.player.y+PIXELLAB_ART_Y-34;for(let i=0;i<2;i++){const streak=this.add.rectangle(x,y+Phaser.Math.Between(-18,18),Phaser.Math.Between(38,68),Phaser.Math.Between(3,7),i?VFX_GREEN:VFX_GREEN_HOT,i?.42:.58).setOrigin(this.facing>0?1:0,.5).setDepth(92).setBlendMode(Phaser.BlendModes.ADD);this.tweens.add({targets:streak,x:x-this.facing*Phaser.Math.Between(30,58),scaleX:1.7,alpha:0,duration:165,ease:'Quad.easeOut',onComplete:()=>streak.destroy()});}}
  spawnLandingBurst(){const x=this.player.x,y=this.player.y+28;for(const dir of[-1,1])for(let i=0;i<2;i++){const streak=this.add.rectangle(x,y-i*3,32+i*10,3,VFX_GREEN_HOT,.65).setOrigin(dir<0?1:0,.5).setDepth(96).setBlendMode(Phaser.BlendModes.ADD);this.tweens.add({targets:streak,x:x+dir*(42+i*12),scaleX:1.55,alpha:0,duration:190,ease:'Quad.easeOut',onComplete:()=>streak.destroy()});}this.spawnGreenBurst(x,y-3,12,42,22,210);}
  startAttack(time,step=null){super.startAttack(time,step);const body=this.player?.body;if(body?.blocked?.down)body.velocity.x+=this.facing*(ATTACK_LUNGE[this.comboStep]||ATTACK_LUNGE[0]);this.setPixelState(this.comboStep===2?'heavy_attack':'light_attack',time,true);this.spawnSwordFlare(this.comboStep);}
  damageEnemy(enemy,step){if(!enemy?.alive)return;const hpBefore=enemy.hp;super.damageEnemy(enemy,step);if(enemy.hp>=hpBefore)return;const body=this.player?.body;if(body)body.velocity.x-=this.facing*(ATTACK_RECOIL[step]||ATTACK_RECOIL[0]);this.spawnImpactBurst(enemy.sprite.x,enemy.sprite.y-8,step);}
  spawnImpactBurst(x,y,step){const heavy=step===2,radius=heavy?42:(step===1?30:24);for(let i=0;i<2;i++){const ring=this.add.circle(x,y,5,0xffffff,0).setStrokeStyle(heavy?5:4,i?VFX_GREEN:VFX_GREEN_CORE,i?.82:.98).setDepth(116).setBlendMode(Phaser.BlendModes.ADD);this.tweens.add({targets:ring,scale:(radius+i*10)/5,alpha:0,duration:(heavy?230:170)+i*45,ease:'Quad.easeOut',onComplete:()=>ring.destroy()});}this.spawnGreenBurst(x,y,heavy?26:15,heavy?72:48,heavy?54:36,heavy?350:250);}
  startRoll(time,b){this.lastRollAt=time;this.rollEndsAt=time+TUNING.rollDurationMs;this.state='rolling';b.setVelocityX(this.facing*TUNING.rollSpeed);this.tweens.killTweensOf(this.player);this.player.setAlpha(1);this.setPixelState('dash',time,true);this.spawnGreenBurst(this.player.x,this.player.y+18,12,38,24,210);this.nextDashTrailAt=time;}
  damagePlayer(time,enemy){const hpBefore=this.playerHp;super.damagePlayer(time,enemy);if(this.playerHp<hpBefore){this.tweens.killTweensOf(this.player);this.player.setAlpha(1);if(!this.dead){this.hitAnimStartsAt=time;this.hitAnimEndsAt=time+420;this.setPixelState('hit',time,true);}}}
  killPlayer(){this.deathAnimStartsAt=this.time.now;super.killPlayer();this.setPixelState('death',this.time.now,true);}
  drawAttackArc(){this.attackArc.clear();this.attackArc.setVisible(false);}
  update(time,delta){super.update(time,delta);if(!this.player)return;this.updatePixelArt(time);const body=this.player.body,grounded=!!body?.blocked?.down;if(this.state==='rolling'&&time>=this.nextDashTrailAt){this.spawnDashTrail();this.nextDashTrailAt=time+28;}if(grounded&&!this.fxWasGrounded&&Math.abs(body?.velocity?.y||0)<40)this.spawnLandingBurst();this.fxWasGrounded=grounded;const speedGlow=Math.min(.09,Math.abs(body?.velocity?.x||0)/6000);this.player.aura.setAlpha(.04+speedGlow).setScale(1+speedGlow*1.8);if(this.debug?.text)this.debug.setText(this.debug.text.replace('DARKBOUND v0.4.0','DARKBOUND v0.7.5 GREEN VFX INTENSE'));}
}