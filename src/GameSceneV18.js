import { GameSceneV17 } from './GameSceneV17.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const PLAYER_FEET_Y=24;
const V17_ART_SCALE=.396;
export const PROTAGONIST_ART_SCALE_V18=.4554;

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

  updatePixelArt(time){
    super.updatePixelArt(time);
    this.applyV18ArtScale();
  }
}
