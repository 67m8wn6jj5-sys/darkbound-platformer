import { GameSceneV10 } from './GameSceneV10.js';
import { TUNING } from './config.js';

const REWARD_DELAY_MS = 420;
const DOUBLE_JUMP_VELOCITY = -535;
const WALL_JUMP_Y = -545;
const WALL_JUMP_X = 350;
const GLIDE_MAX_FALL = 165;

const UPGRADE_POOL = Object.freeze([
  { id:'doubleJump', name:'DOUBLE JUMP', type:'skill', description:'Press jump again in mid-air.', maxStacks:1 },
  { id:'wallJump', name:'WALL JUMP', type:'skill', description:'Press jump while touching a wall.', maxStacks:1 },
  { id:'glide', name:'GLIDE', type:'skill', description:'Hold jump while falling to slow descent.', maxStacks:1 },
  { id:'damage', name:'SHARPENED EDGE', type:'stat', description:'+1 damage to every sword hit.', maxStacks:3 },
  { id:'heavyDamage', name:'EXECUTIONER', type:'stat', description:'+1 additional heavy-attack damage.', maxStacks:3 },
  { id:'maxHp', name:'COLOSSUS HEART', type:'stat', description:'+1 max HP and heal 1 HP.', maxStacks:3 }
]);

export class GameSceneV11 extends GameSceneV10 {
  create(){
    super.create();

    this.runUpgrades = new Map();
    this.skills = { doubleJump:false, wallJump:false, glide:false };
    this.runStats = { damage:0, heavyDamage:0, maxHp:TUNING.playerMaxHp };
    this.airJumpsUsed = 0;
    this.rewardActive = false;
    this.rewardChoices = [];
    this.rewardSelection = 0;
    this.rewardInputLockUntil = 0;
    this._rewardPad = { left:false, right:false, a:false };

    const originalUpdate = this.inputManager.update.bind(this.inputManager);
    this.inputManager.update = () => {
      const cmd = originalUpdate();
      this._lastCommand = cmd;
      return cmd;
    };

    this.createRewardUI();
    this.updateHud();
  }

  createRewardUI(){
    const depth = 1800;
    const backdrop = this.add.rectangle(0,0,100,100,0x05070d,.94).setOrigin(0).setScrollFactor(0).setDepth(depth).setVisible(false);
    const title = this.add.text(0,0,'CHOOSE A REWARD',{
      fontFamily:'system-ui',fontSize:'22px',fontStyle:'bold',color:'#ffffff',align:'center'
    }).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
    const subtitle = this.add.text(0,0,'Tap a card • D-pad/← → + A/Enter',{
      fontFamily:'system-ui',fontSize:'11px',color:'#aeb8cc',align:'center'
    }).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);

    const cards=[];
    for(let i=0;i<3;i++){
      const bg=this.add.rectangle(0,0,220,140,0x101727,.98).setStrokeStyle(2,0x54627d,1).setScrollFactor(0).setDepth(depth+1).setVisible(false).setInteractive({useHandCursor:true});
      const name=this.add.text(0,0,'',{
        fontFamily:'system-ui',fontSize:'15px',fontStyle:'bold',color:'#ffffff',align:'center',wordWrap:{width:190}
      }).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      const type=this.add.text(0,0,'',{
        fontFamily:'system-ui',fontSize:'10px',fontStyle:'bold',color:'#71ff8a',align:'center'
      }).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      const desc=this.add.text(0,0,'',{
        fontFamily:'system-ui',fontSize:'11px',color:'#cbd3e4',align:'center',wordWrap:{width:190}
      }).setOrigin(.5,0).setScrollFactor(0).setDepth(depth+2).setVisible(false);
      bg.on('pointerover',()=>{if(this.rewardActive){this.rewardSelection=i;this.refreshRewardSelection();}});
      bg.on('pointerdown',()=>{if(this.rewardActive)this.chooseReward(i);});
      cards.push({bg,name,type,desc});
    }

    this.rewardUI={backdrop,title,subtitle,cards};
    this.scale.on('resize',()=>this.layoutRewardUI());
  }

  layoutRewardUI(){
    if(!this.rewardUI)return;
    const w=this.scale.width,h=this.scale.height;
    const cardW=Math.min(238,Math.max(180,w*.27));
    const cardH=Math.min(158,Math.max(124,h*.50));
    const cardY=Math.max(118,h*.56);
    this.rewardUI.backdrop.setSize(w,h);
    this.rewardUI.title.setPosition(w/2,Math.max(18,h*.09));
    this.rewardUI.subtitle.setPosition(w/2,Math.max(48,h*.20));
    const xs=[w*.2,w*.5,w*.8];
    this.rewardUI.cards.forEach((card,i)=>{
      card.bg.setPosition(xs[i],cardY).setSize(cardW,cardH);
      card.name.setPosition(xs[i],cardY-cardH/2+16).setWordWrapWidth(cardW-24);
      card.type.setPosition(xs[i],cardY-cardH/2+42);
      card.desc.setPosition(xs[i],cardY-cardH/2+63).setWordWrapWidth(cardW-24);
    });
  }

  setRewardUIVisible(visible){
    if(!this.rewardUI)return;
    this.rewardUI.backdrop.setVisible(visible);
    this.rewardUI.title.setVisible(visible);
    this.rewardUI.subtitle.setVisible(visible);
    this.rewardUI.cards.forEach(card=>{
      card.bg.setVisible(visible);
      card.name.setVisible(visible);
      card.type.setVisible(visible);
      card.desc.setVisible(visible);
    });
  }

  currentUpgradeStacks(id){return this.runUpgrades.get(id)||0;}

  rollRewardChoices(){
    const eligible=UPGRADE_POOL.filter(upgrade=>this.currentUpgradeStacks(upgrade.id)<upgrade.maxStacks);
    const shuffled=Phaser.Utils.Array.Shuffle([...eligible]);
    const fallback=UPGRADE_POOL.filter(u=>u.type==='stat');
    while(shuffled.length<3)shuffled.push(fallback[shuffled.length%fallback.length]);
    return shuffled.slice(0,3);
  }

  openReward(roomIndex){
    if(this.rewardActive||this.dead)return;
    this.rewardActive=true;
    this.rewardRoomIndex=roomIndex;
    this.rewardSelection=0;
    this.rewardChoices=this.rollRewardChoices();
    this.rewardInputLockUntil=this.time.now+180;
    this.physics.pause();
    this.touchControls?.setVisible(false);
    this.setRewardUIVisible(true);
    this.layoutRewardUI();
    this.rewardChoices.forEach((choice,i)=>{
      const card=this.rewardUI.cards[i];
      const stacks=this.currentUpgradeStacks(choice.id);
      card.name.setText(choice.name);
      card.type.setText(choice.type==='skill'?'NEW SKILL':`UPGRADE${stacks?` • LV ${stacks+1}`:''}`);
      card.desc.setText(choice.description);
    });
    this.refreshRewardSelection();
  }

  refreshRewardSelection(){
    if(!this.rewardUI)return;
    this.rewardUI.cards.forEach((card,i)=>{
      const selected=i===this.rewardSelection;
      card.bg.setStrokeStyle(selected?4:2,selected?0x68ff83:0x54627d,1);
      card.bg.setFillStyle(selected?0x15261d:0x101727,.98);
      card.name.setScale(selected?1.04:1);
    });
  }

  applyUpgrade(upgrade){
    const stacks=this.currentUpgradeStacks(upgrade.id)+1;
    this.runUpgrades.set(upgrade.id,stacks);
    if(upgrade.type==='skill')this.skills[upgrade.id]=true;
    if(upgrade.id==='damage')this.runStats.damage=stacks;
    if(upgrade.id==='heavyDamage')this.runStats.heavyDamage=stacks;
    if(upgrade.id==='maxHp'){
      this.runStats.maxHp=TUNING.playerMaxHp+stacks;
      this.playerHp=Math.min(this.runStats.maxHp,this.playerHp+1);
    }
    this.updateHud();
  }

  chooseReward(index){
    if(!this.rewardActive||this.time.now<this.rewardInputLockUntil)return;
    const choice=this.rewardChoices[index];
    if(!choice)return;
    this.applyUpgrade(choice);
    this.rewardActive=false;
    this.setRewardUIVisible(false);
    this.touchControls?.setVisible(true);
    if(!this.dead&&!this.pausePanel?.bg?.visible)this.physics.resume();
    this.showRoomBanner(`${choice.name} ACQUIRED`,700);
    this.spawnGreenBurst(this.player.x,this.player.y-20,20,60,48,300);
  }

  handleRewardInput(){
    if(!this.rewardActive)return;
    const keyboard=this.input.keyboard;
    if(keyboard){
      if(!this._rewardKeys){
        this._rewardKeys=keyboard.addKeys({left:'LEFT',right:'RIGHT',left2:'A',right2:'D',select:'ENTER',select2:'SPACE'});
      }
      if(Phaser.Input.Keyboard.JustDown(this._rewardKeys.left)||Phaser.Input.Keyboard.JustDown(this._rewardKeys.left2)){
        this.rewardSelection=(this.rewardSelection+2)%3;this.refreshRewardSelection();
      }
      if(Phaser.Input.Keyboard.JustDown(this._rewardKeys.right)||Phaser.Input.Keyboard.JustDown(this._rewardKeys.right2)){
        this.rewardSelection=(this.rewardSelection+1)%3;this.refreshRewardSelection();
      }
      if(Phaser.Input.Keyboard.JustDown(this._rewardKeys.select)||Phaser.Input.Keyboard.JustDown(this._rewardKeys.select2))this.chooseReward(this.rewardSelection);
    }

    const pad=this.inputManager?.getActivePad?.();
    if(!pad)return;
    const left=this.inputManager.buttonDown(pad,'left',14);
    const right=this.inputManager.buttonDown(pad,'right',15);
    const a=this.inputManager.buttonDown(pad,'A',0);
    if(left&&!this._rewardPad.left){this.rewardSelection=(this.rewardSelection+2)%3;this.refreshRewardSelection();}
    if(right&&!this._rewardPad.right){this.rewardSelection=(this.rewardSelection+1)%3;this.refreshRewardSelection();}
    if(a&&!this._rewardPad.a)this.chooseReward(this.rewardSelection);
    this._rewardPad={left,right,a};
  }

  clearRoom(index,time){
    const wasCombat=this.rooms?.[index]?.state==='combat';
    super.clearRoom(index,time);
    if(wasCombat)this.time.delayedCall(REWARD_DELAY_MS,()=>this.openReward(index));
  }

  damageEnemy(enemy,step){
    if(!enemy?.alive)return;
    const bonus=(this.runStats?.damage||0)+(step===2?(this.runStats?.heavyDamage||0):0);
    if(bonus>0)enemy.hp=Math.max(0,enemy.hp-bonus);
    super.damageEnemy(enemy,step);
  }

  updateHud(){
    if(!this.hud)return;
    const maxHp=this.runStats?.maxHp||TUNING.playerMaxHp;
    const alive=this.enemies?.filter(enemy=>enemy.alive).length||0;
    const hpSummary=(this.enemies||[]).map((enemy,i)=>{
      if(!enemy.alive)return `E${i+1} ✓`;
      const max=enemy.maxHp||TUNING.enemyMaxHp;
      return `E${i+1} ${enemy.hp}/${max}`;
    }).join('  ');
    this.hud.setText(`HP ${this.playerHp}/${maxHp}   •   ${hpSummary}   •   ${alive} HOSTILE${alive===1?'':'S'}`);
  }

  update(time,delta){
    if(this.rewardActive){
      this.handleRewardInput();
      return;
    }

    const b=this.player?.body;
    const groundedBefore=!!b?.blocked?.down;
    const wallLeftBefore=!!b?.blocked?.left;
    const wallRightBefore=!!b?.blocked?.right;
    const coyoteBefore=time-(this.lastGroundedAt??-Infinity)<=TUNING.coyoteMs;

    super.update(time,delta);
    if(!b||this.dead||this.rewardActive)return;

    const cmd=this._lastCommand;
    const grounded=!!b.blocked.down;
    if(grounded)this.airJumpsUsed=0;

    if(cmd?.jumpPressed&&!groundedBefore&&!coyoteBefore){
      const touchingWall=wallLeftBefore||wallRightBefore;
      if(this.skills?.wallJump&&touchingWall){
        const direction=wallLeftBefore?1:-1;
        b.setVelocity(direction*WALL_JUMP_X,WALL_JUMP_Y);
        this.facing=direction;
        this.jumpBufferedAt=-Infinity;
        this.spawnGreenBurst(this.player.x-direction*10,this.player.y-8,10,28,32,190);
      }else if(this.skills?.doubleJump&&this.airJumpsUsed<1){
        this.airJumpsUsed++;
        b.setVelocityY(DOUBLE_JUMP_VELOCITY);
        this.jumpBufferedAt=-Infinity;
        this.spawnGreenBurst(this.player.x,this.player.y+18,12,34,26,190);
      }
    }

    if(this.skills?.glide&&!grounded&&cmd?.jumpHeld&&b.velocity.y>GLIDE_MAX_FALL){
      b.velocity.y=GLIDE_MAX_FALL;
    }
  }
}
