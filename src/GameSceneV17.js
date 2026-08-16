import { GameSceneV16 } from './GameSceneV16.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const ROOT='./assets/v05/pixellab_protagonist';
const PLAYER_FEET_Y=24;
const SOURCE_CANVAS_HEIGHT=184;
const SOURCE_GROUND_ALPHA_BOTTOM=138;
const ART_SCALE=.36;
// The approved PixelLab sprites share a 184x184 canvas. Grounded reference
// poses end at source y=138, leaving 46 transparent pixels below the boots.
// Account for that padding at runtime so visible feet align with the unchanged
// Arcade body rather than anchoring the transparent canvas edge to the floor.
const PLAYER_ART_BOTTOM_Y=PLAYER_FEET_Y+(SOURCE_CANVAS_HEIGHT-SOURCE_GROUND_ALPHA_BOTTOM)*ART_SCALE;

const ROTATION_RING=Object.freeze(['east','south-east','south','south-west','west','north-west','north','north-east']);
const TURN_STEP_MS=18;
const LANDING_MS=180;
const TURN_ELIGIBLE=new Set(['idle','run','jump','fall','land']);
const ATTACK_VISUAL_PHASES=Object.freeze({
  // The light sequence has essentially no wind-up: frame 000 is the anticipation
  // pose and frames 001-005 carry the readable cutting motion.
  light_attack:{activeFirst:1,activeLast:5},
  // Visual review of the approved heavy sequence shows frames 000-004 as the
  // overhead wind-up and 005-007 as the actual downward impact. Mapping those
  // poses onto the existing gameplay active window keeps damage timing unchanged.
  heavy_attack:{activeFirst:5,activeLast:7},
});

function frameKey(action,direction,index){
  return `px-${action}-${direction}-${String(index).padStart(3,'0')}`;
}

function rotationKey(source,direction){
  return `px-rotation-${source}-${direction}`;
}

function clamp01(value){
  return Math.max(0,Math.min(1,value));
}

function rangedFrame(first,last,progress){
  if(last<=first)return Math.max(0,first);
  const count=last-first+1;
  return first+Math.min(count-1,Math.floor(clamp01(progress)*count));
}

export class GameSceneV17 extends GameSceneV16 {
  preload(){
    // GameSceneV05 already loads every east/west animation sequence described
    // by the generated manifest. Do not load those frames a second time here.
    super.preload();

    // Rotation artwork is unique and intentionally separate from the east/west
    // animation sequences. Load each source set exactly once; land reuses fall.
    const loaded=new Set();
    for(const [action,meta] of Object.entries(PIXELLAB_MANIFEST)){
      if(!meta||typeof meta!=='object')continue;
      const source=meta.rotationSource||action;
      for(const direction of meta.rotations||[]){
        const identity=`${source}:${direction}`;
        if(loaded.has(identity))continue;
        loaded.add(identity);
        this.load.image(
          rotationKey(source,direction),
          `${ROOT}/${source}/rotations/${direction}.png?v=protagonist-production-1`
        );
      }
    }
  }

  create(){
    super.create();
    const logical=this.facing<0?'west':'east';
    this.visualDirection=logical;
    this.turnTargetDirection=logical;
    this.turning=false;
    this.nextTurnStepAt=0;
    this.visualAnimationState='idle';
    this.animationWasGrounded=!!this.player?.body?.blocked?.down;
    this.landingStartedAt=-Infinity;
    this.landingEndsAt=-Infinity;

    if(this.pixelArt){
      this.pixelArt
        .setPosition(this.player.x,this.player.y+PLAYER_ART_BOTTOM_Y)
        .setOrigin(.5,1)
        .setScale(ART_SCALE);
    }
  }

  resolvePixelState(time){
    const body=this.player?.body;
    if(!body)return'idle';

    // Centralized visual priority. Lower-priority locomotion cannot interrupt
    // death, damage, combat, or dodge animations.
    if(this.dead)return'death';
    if(time<this.hitAnimEndsAt)return'hit';
    if(this.state?.startsWith('attack-'))return this.comboStep===2?'heavy_attack':'light_attack';
    if(this.state==='rolling')return'dash';
    if(!body.blocked.down)return body.velocity.y<0?'jump':'fall';
    if(time<this.landingEndsAt)return'land';
    if(this.state==='running')return'run';
    return'idle';
  }

  attackFrame(action,direction,time){
    const meta=PIXELLAB_MANIFEST[action];
    const count=Math.max(1,meta?.[direction]||1);
    const step=this.comboStep===2?2:Math.max(0,Math.min(1,this.comboStep||0));
    const duration=TUNING.attackDurationsMs[step]||1;
    const activeStart=TUNING.attackActiveStartMs[step]||0;
    const activeEnd=Math.max(activeStart,TUNING.attackActiveEndMs[step]||activeStart);
    const elapsed=Math.max(0,Math.min(duration,time-(this.attackStartsAt||time)));
    const profile=ATTACK_VISUAL_PHASES[action]||{activeFirst:1,activeLast:Math.max(1,count-2)};
    const activeFirst=Math.max(0,Math.min(count-1,profile.activeFirst));
    const activeLast=Math.max(activeFirst,Math.min(count-1,profile.activeLast));

    if(elapsed<activeStart){
      const last=Math.max(0,activeFirst-1);
      return rangedFrame(0,last,activeStart>0?elapsed/activeStart:1);
    }
    if(elapsed<=activeEnd){
      return rangedFrame(activeFirst,activeLast,activeEnd>activeStart?(elapsed-activeStart)/(activeEnd-activeStart):1);
    }
    return rangedFrame(
      Math.min(count-1,activeLast+1),
      count-1,
      duration>activeEnd?(elapsed-activeEnd)/(duration-activeEnd):1
    );
  }

  frameForState(action,direction,time){
    const meta=PIXELLAB_MANIFEST[action];
    const count=Math.max(1,meta?.[direction]||1);
    if(count===1)return 0;

    if(action==='light_attack'||action==='heavy_attack')return this.attackFrame(action,direction,time);

    if(action==='dash'){
      const started=Number.isFinite(this.lastRollAt)?this.lastRollAt:time;
      return rangedFrame(0,count-1,(time-started)/Math.max(1,TUNING.rollDurationMs));
    }

    if(action==='hit'){
      const started=Number.isFinite(this.hitAnimStartsAt)?this.hitAnimStartsAt:time;
      const duration=Math.max(1,(this.hitAnimEndsAt||time)-started);
      return rangedFrame(0,count-1,(time-started)/duration);
    }

    if(action==='land'){
      return rangedFrame(0,count-1,(time-this.landingStartedAt)/LANDING_MS);
    }

    if(action==='death'){
      const started=Number.isFinite(this.deathAnimStartsAt)?this.deathAnimStartsAt:this.pixelStateStartedAt;
      const elapsed=Math.max(0,time-started);
      return Math.min(count-1,Math.floor(elapsed/1000*(meta?.fps||10)));
    }

    const elapsed=Math.max(0,time-this.pixelStateStartedAt);
    const fps=meta?.fps||12;
    if(meta?.loop)return Math.floor(elapsed/1000*fps)%count;
    return Math.min(count-1,Math.floor(elapsed/1000*fps));
  }

  beginOrUpdateTurn(logicalDirection,time){
    if(!this.visualDirection)this.visualDirection=logicalDirection;
    if(!this.turnTargetDirection)this.turnTargetDirection=this.visualDirection;

    if(logicalDirection!==this.turnTargetDirection){
      this.turnTargetDirection=logicalDirection;
      if(!this.turning){
        this.turning=true;
        this.nextTurnStepAt=time+TURN_STEP_MS;
      }
    }else if(!this.turning&&this.visualDirection!==logicalDirection){
      this.turning=true;
      this.nextTurnStepAt=time+TURN_STEP_MS;
    }

    if(!this.turning)return false;

    // Catch up after a long frame without ever delaying gameplay facing or
    // velocity. A 180-degree reversal deliberately takes opposite compass arcs:
    // E -> SE -> S -> SW -> W and W -> NW -> N -> NE -> E.
    let guard=0;
    while(time>=this.nextTurnStepAt&&guard++<ROTATION_RING.length+2){
      if(this.visualDirection===this.turnTargetDirection){
        this.turning=false;
        break;
      }
      const current=ROTATION_RING.indexOf(this.visualDirection);
      const target=ROTATION_RING.indexOf(this.turnTargetDirection);
      if(current<0||target<0){
        this.visualDirection=this.turnTargetDirection;
        this.turning=false;
        break;
      }
      const clockwise=(target-current+ROTATION_RING.length)%ROTATION_RING.length;
      const counter=(current-target+ROTATION_RING.length)%ROTATION_RING.length;
      const step=clockwise<=counter?1:-1;
      this.visualDirection=ROTATION_RING[(current+step+ROTATION_RING.length)%ROTATION_RING.length];
      this.nextTurnStepAt+=TURN_STEP_MS;
    }
    return this.turning;
  }

  cancelTurn(logicalDirection){
    this.turning=false;
    this.turnTargetDirection=logicalDirection;
    this.visualDirection=logicalDirection;
  }

  updatePixelArt(time){
    if(!this.pixelArt)return;
    const body=this.player?.body;
    const grounded=!!body?.blocked?.down;

    // Detect the physical airborne -> grounded transition before resolving the
    // visual state. Landing is purely visual; movement input remains immediate.
    if(grounded&&!this.animationWasGrounded&&!this.dead){
      this.landingStartedAt=time;
      this.landingEndsAt=time+LANDING_MS;
    }

    const action=this.resolvePixelState(time);
    this.setPixelState(action,time);
    const logicalDirection=this.facing<0?'west':'east';
    let key='';

    if(TURN_ELIGIBLE.has(action)){
      const turning=this.beginOrUpdateTurn(logicalDirection,time);
      if(turning){
        const source=PIXELLAB_MANIFEST[action]?.rotationSource||action;
        key=rotationKey(source,this.visualDirection);
        this.visualAnimationState='turning';
      }else{
        this.visualDirection=logicalDirection;
        key=frameKey(action,logicalDirection,this.frameForState(action,logicalDirection,time));
        this.visualAnimationState=action;
      }
    }else{
      // Important animations use their dedicated east/west sequences immediately
      // and are never interrupted by a cosmetic turn transition.
      this.cancelTurn(logicalDirection);
      key=frameKey(action,logicalDirection,this.frameForState(action,logicalDirection,time));
      this.visualAnimationState=action;
    }

    if(key!==this.currentPixelKey){
      this.pixelArt.setTexture(key);
      this.currentPixelKey=key;
    }
    this.pixelDirection=logicalDirection;
    this.pixelArt
      .setPosition(this.player.x,this.player.y+PLAYER_ART_BOTTOM_Y)
      .setOrigin(.5,1)
      .setScale(ART_SCALE)
      .setFlipX(false)
      .setVisible(true);
    this.player.art.setVisible(false);
    this.animationWasGrounded=grounded;
  }
}
