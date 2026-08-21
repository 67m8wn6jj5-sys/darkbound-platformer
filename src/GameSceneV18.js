import { GameSceneV17 } from './GameSceneV17.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const PLAYER_FEET_Y=24;
const V17_ART_SCALE=.396;
export const PROTAGONIST_ART_SCALE_V18=.4554;
const VFX_GREEN=0x43ff57;
const VFX_GREEN_HOT=0xbfff8f;
const VFX_GREEN_CORE=0xf2ffe1;

// V27 visual combo: all three live sword strikes come only from the two
// 2026-08-21 attack packs. The order is deliberately readable as a quick
// forward cut -> rising slash -> longer committed finishing cut. Gameplay
// timing, damage, range, knockback and charge-priority stay in config/V21.
const ATTACK_COMBO_PATTERNS=Object.freeze([
  Object.freeze(['attack_1','attack_2','attack_3']),
]);

const ATTACK_VISUAL_PHASES=Object.freeze({
  attack_1:{activeFirst:2,activeLast:5,anticipationExponent:.72,recoveryExponent:1.2},
  attack_2:{activeFirst:2,activeLast:5,anticipationExponent:.74,recoveryExponent:1.15},
  attack_3:{activeFirst:3,activeLast:7,anticipationExponent:.78,recoveryExponent:1.08},
});

// Frame-specific blade trails for the new art. These are cosmetic only. The
// rising attack climbs sharply through frames 2-5, while the finisher gets the
// longest trail and strongest particles across its wider 3-7 contact arc.
const ATTACK_FX_V27=Object.freeze({
  attack_1:Object.freeze({
    2:{x:34,y:-50,angle:-24,length:126,width:8,travelX:22,travelY:-6,intensity:.9},
    3:{x:52,y:-48,angle:-10,length:144,width:9,travelX:28,travelY:-2,intensity:1},
    4:{x:72,y:-36,angle:6,length:158,width:9,travelX:34,travelY:8,intensity:1.04},
    5:{x:92,y:-20,angle:16,length:168,width:10,travelX:42,travelY:14,intensity:1.08},
  }),
  attack_2:Object.freeze({
    2:{x:30,y:-12,angle:-52,length:134,width:9,travelX:16,travelY:-24,intensity:.96},
    3:{x:40,y:-38,angle:-60,length:154,width:10,travelX:18,travelY:-32,intensity:1.04},
    4:{x:46,y:-66,angle:-68,length:174,width:10,travelX:16,travelY:-38,intensity:1.12},
    5:{x:42,y:-88,angle:-76,length:160,width:9,travelX:10,travelY:-30,intensity:1.06},
  }),
  attack_3:Object.freeze({
    3:{x:12,y:-72,angle:-38,length:158,width:10,travelX:20,travelY:10,intensity:1},
    4:{x:42,y:-62,angle:-16,length:184,width:11,travelX:34,travelY:16,intensity:1.12},
    5:{x:70,y:-44,angle:12,length:210,width:13,travelX:48,travelY:26,intensity:1.24},
    6:{x:94,y:-20,angle:34,length:226,width:14,travelX:62,travelY:36,intensity:1.34},
    7:{x:108,y:4,angle:52,length:198,width:12,travelX:54,travelY:38,intensity:1.24},
  }),
});

function clamp01(value){
  return Math.max(0,Math.min(1,value));
}

function rangedFrame(first,last,progress){
  if(last<=first)return Math.max(0,first);
  const count=last-first+1;
  return first+Math.min(count-1,Math.floor(clamp01(progress)*count));
}

function sourceDirection(meta,direction){
  if(direction==='west'&&meta?.mirrorWest)return meta.mirrorSourceDirection||'east';
  if(direction==='east'&&meta?.mirrorEast)return meta.mirrorSourceDirection||'west';
  return direction;
}

function frameCount(meta,direction){
  const source=sourceDirection(meta,direction);
  return Math.max(1,meta?.[source]||1);
}

function mirroredAngle(angle,facing){
  return facing>0?angle:180-angle;
}

export class GameSceneV18 extends GameSceneV17 {
  create(){
    super.create();
    this.attackPatternIndex=-1;
    this.attackVisualAction='attack_1';
    this.lastVisualAttackAction='';
    this.applyV18ArtScale();
  }

  applyV18ArtScale(){
    if(!this.pixelArt||!this.player)return;
    const oldOffset=this.pixelArt.y-(this.player.y+PLAYER_FEET_Y);
    const bottomPadding=Math.abs(V17_ART_SCALE)>1e-6?oldOffset/V17_ART_SCALE:0;
    this.pixelArt
      .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y+bottomPadding*PROTAGONIST_ART_SCALE_V18)
      .setScale(PROTAGONIST_ART_SCALE_V18);
  }

  attackVisualForStep(step=this.comboStep,patternIndex=this.attackPatternIndex){
    const safeStep=Math.max(0,Math.min(2,Number(step)||0));
    const safePattern=patternIndex>=0?patternIndex%ATTACK_COMBO_PATTERNS.length:0;
    const candidate=ATTACK_COMBO_PATTERNS[safePattern]?.[safeStep];
    return PIXELLAB_MANIFEST[candidate]?candidate:this.attackActionForStep(safeStep);
  }

  startAttack(time,step=null){
    super.startAttack(time,step);
    if(this.comboStep===0){
      this.attackPatternIndex=(this.attackPatternIndex+1)%ATTACK_COMBO_PATTERNS.length;
    }
    const action=this.attackVisualForStep(this.comboStep,this.attackPatternIndex);
    this.attackVisualAction=action;
    this.lastVisualAttackAction=action;
    this.setPixelState(action,time,true);
    this.lastAttackFxToken='';
  }

  resolvePixelState(time){
    const resolved=super.resolvePixelState(time);
    if(this.state?.startsWith('attack-')&&resolved.startsWith('attack_')){
      return PIXELLAB_MANIFEST[this.attackVisualAction]?this.attackVisualAction:resolved;
    }
    return resolved;
  }

  attackFrame(action,direction,time){
    const meta=PIXELLAB_MANIFEST[action];
    const count=frameCount(meta,direction);
    const step=Math.max(0,Math.min(2,Number(this.comboStep)||0));
    const duration=TUNING.attackDurationsMs[step]||1;
    const activeStart=TUNING.attackActiveStartMs[step]||0;
    const activeEnd=Math.max(activeStart,TUNING.attackActiveEndMs[step]||activeStart);
    const elapsed=Math.max(0,Math.min(duration,time-(this.attackStartsAt||time)));
    const phase=ATTACK_VISUAL_PHASES[action]||{
      activeFirst:1,
      activeLast:Math.max(1,count-2),
      anticipationExponent:.75,
      recoveryExponent:1.2,
    };
    const activeFirst=Math.max(0,Math.min(count-1,phase.activeFirst));
    const activeLast=Math.max(activeFirst,Math.min(count-1,phase.activeLast));

    if(elapsed<activeStart){
      const raw=activeStart>0?elapsed/activeStart:1;
      const shaped=Math.pow(clamp01(raw),phase.anticipationExponent||.75);
      return rangedFrame(0,Math.max(0,activeFirst-1),shaped);
    }
    if(elapsed<=activeEnd){
      const raw=activeEnd>activeStart?(elapsed-activeStart)/(activeEnd-activeStart):1;
      return rangedFrame(activeFirst,activeLast,raw);
    }
    const raw=duration>activeEnd?(elapsed-activeEnd)/(duration-activeEnd):1;
    const shaped=Math.pow(clamp01(raw),phase.recoveryExponent||1.2);
    return rangedFrame(Math.min(count-1,activeLast+1),count-1,shaped);
  }

  emitAttackMotionFx(action,frame,time){
    const profile=ATTACK_FX_V27[action]?.[frame];
    if(!profile)return;
    const token=`${this.attackStartsAt}:${action}:${frame}`;
    if(token===this.lastAttackFxToken)return;
    this.lastAttackFxToken=token;

    const facing=this.facing<0?-1:1;
    const x=this.player.x+facing*profile.x*PROTAGONIST_ART_SCALE_V18;
    const y=this.player.y+PLAYER_FEET_Y+profile.y*PROTAGONIST_ART_SCALE_V18;
    const angle=mirroredAngle(profile.angle,facing);
    const radians=angle*Math.PI/180;
    const normalX=Math.cos(radians+Math.PI/2);
    const normalY=Math.sin(radians+Math.PI/2);
    const length=profile.length*PROTAGONIST_ART_SCALE_V18;
    const width=Math.max(2,profile.width*PROTAGONIST_ART_SCALE_V18);
    const intensity=profile.intensity||1;
    const colors=[VFX_GREEN,VFX_GREEN_HOT,VFX_GREEN_CORE];

    for(let i=0;i<3;i++){
      const offset=(i-1)*4*PROTAGONIST_ART_SCALE_V18;
      const streak=this.add.rectangle(
        x+normalX*offset,
        y+normalY*offset,
        length*(.88+i*.08),
        width*(1.55-i*.38),
        colors[i],
        [.26,.54,.9][i]
      ).setOrigin(.5,.5).setAngle(angle).setDepth(108+i).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:streak,
        x:streak.x+facing*profile.travelX*PROTAGONIST_ART_SCALE_V18,
        y:streak.y+profile.travelY*PROTAGONIST_ART_SCALE_V18,
        scaleX:1.08,
        scaleY:.06,
        alpha:0,
        duration:Math.round(90+i*18),
        ease:'Quad.easeOut',
        onComplete:()=>streak.destroy(),
      });
    }

    const tipX=x+Math.cos(radians)*length*.48;
    const tipY=y+Math.sin(radians)*length*.48;
    for(let i=0;i<4;i++){
      const spark=this.add.circle(
        tipX+Phaser.Math.Between(-3,3),
        tipY+Phaser.Math.Between(-3,3),
        Phaser.Math.Between(1,3),
        i===0?VFX_GREEN_CORE:VFX_GREEN_HOT,
        .9
      ).setDepth(114).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:spark,
        x:spark.x+facing*Phaser.Math.Between(10,24)*intensity,
        y:spark.y+Phaser.Math.Between(-12,10)*intensity,
        alpha:0,
        scale:.08,
        duration:Phaser.Math.Between(85,145),
        ease:'Quad.easeOut',
        onComplete:()=>spark.destroy(),
      });
    }
  }

  updatePixelArt(time){
    super.updatePixelArt(time);
    this.applyV18ArtScale();
  }
}
