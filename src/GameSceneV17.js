import { GameSceneV16 } from './GameSceneV16.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const ROOT='./assets/v05/pixellab_protagonist';
const PLAYER_FEET_Y=24;
const ART_SCALE=.36;

const ROTATION_RING=Object.freeze(['east','south-east','south','south-west','west','north-west','north','north-east']);
const TURN_STEP_MS=18;
const LANDING_MS=180;
const TURN_ELIGIBLE=new Set(['idle','run','jump','fall','land']);
const ATTACK_VISUAL_PHASES=Object.freeze({
  // New export provides three discrete sword sequences. The frame windows below
  // correspond to the readable blade-contact portion of each approved sequence
  // while preserving the game's existing hitbox timing.
  attack_1:{activeFirst:2,activeLast:6},
  attack_2:{activeFirst:4,activeLast:6},
  attack_3:{activeFirst:4,activeLast:6},
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

function sourceDirection(meta,direction){
  if(direction==='west'&&meta?.mirrorWest)return meta.mirrorSourceDirection||'east';
  if(direction==='east'&&meta?.mirrorEast)return meta.mirrorSourceDirection||'west';
  return direction;
}

function frameCount(meta,direction){
  const source=sourceDirection(meta,direction);
  return Math.max(1,meta?.[source]||1);
}

function framePadding(meta,direction,index){
  const source=sourceDirection(meta,direction);
  const values=meta?.frameBottomPadding?.[source]||[];
  if(!values.length)return 0;
  return Number(values[Math.max(0,Math.min(values.length-1,index))])||0;
}

function shouldMirror(meta,direction){
  return (direction==='west'&&!!meta?.mirrorWest)||(direction==='east'&&!!meta?.mirrorEast);
}

export class GameSceneV17 extends GameSceneV16 {
  preload(){
    // V05 loads all supplied east/west frame sequences. V17 adds the eight-way
    // rotation poses once per source set; three sword attacks share one set.
    super.preload();
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
          `${ROOT}/${source}/rotations/${direction}.png?v=protagonist-20260818-1`
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
      const initialPadding=framePadding(PIXELLAB_MANIFEST.idle,logical,0);
      this.pixelArt
        .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y+initialPadding*ART_SCALE)
        .setOrigin(.5,1)
        .setScale(ART_SCALE);
    }
  }

  resolvePixelState(time){
    const body=this.player?.body;
    if(!body)return'idle';
    if(this.dead)return'death';
    if(time<this.hitAnimEndsAt)return'hit';
    if(this.state?.startsWith('attack-'))return`attack_${Math.max(1,Math.min(3,(this.comboStep||0)+1))}`;
    if(this.state==='rolling')return'dash';
    if(!body.blocked.down)return body.velocity.y<0?'jump':'fall';
    if(time<this.landingEndsAt)return'land';
    if(this.state==='running')return'run';
    return'idle';
  }

  attackFrame(action,direction,time){
    const meta=PIXELLAB_MANIFEST[action];
    const count=frameCount(meta,direction);
    const actionStep=Math.max(0,Math.min(2,(Number(action.slice(-1))||1)-1));
    const duration=TUNING.attackDurationsMs[actionStep]||1;
    const activeStart=TUNING.attackActiveStartMs[actionStep]||0;
    const activeEnd=Math.max(activeStart,TUNING.attackActiveEndMs[actionStep]||activeStart);
    const elapsed=Math.max(0,Math.min(duration,time-(this.attackStartsAt||time)));
    const profile=ATTACK_VISUAL_PHASES[action]||{activeFirst:1,activeLast:Math.max(1,count-2)};
    const activeFirst=Math.max(0,Math.min(count-1,profile.activeFirst));
    const activeLast=Math.max(activeFirst,Math.min(count-1,profile.activeLast));

    if(elapsed<activeStart){
      return rangedFrame(0,Math.max(0,activeFirst-1),activeStart>0?elapsed/activeStart:1);
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
    const count=frameCount(meta,direction);
    if(count===1)return 0;

    if(action.startsWith('attack_'))return this.attackFrame(action,direction,time);

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

    if(grounded&&!this.animationWasGrounded&&!this.dead){
      this.landingStartedAt=time;
      this.landingEndsAt=time+LANDING_MS;
    }

    const action=this.resolvePixelState(time);
    this.setPixelState(action,time);
    const meta=PIXELLAB_MANIFEST[action];
    const logicalDirection=this.facing<0?'west':'east';
    let key='';
    let bottomPadding=0;
    let flip=false;

    if(TURN_ELIGIBLE.has(action)){
      const turning=this.beginOrUpdateTurn(logicalDirection,time);
      if(turning){
        const source=meta?.rotationSource||action;
        key=rotationKey(source,this.visualDirection);
        bottomPadding=Number(meta?.rotationBottomPadding?.[this.visualDirection])||0;
        this.visualAnimationState='turning';
      }else{
        this.visualDirection=logicalDirection;
        const frame=this.frameForState(action,logicalDirection,time);
        const textureDirection=sourceDirection(meta,logicalDirection);
        key=frameKey(action,textureDirection,frame);
        bottomPadding=framePadding(meta,logicalDirection,frame);
        flip=shouldMirror(meta,logicalDirection);
        this.visualAnimationState=action;
      }
    }else{
      this.cancelTurn(logicalDirection);
      const frame=this.frameForState(action,logicalDirection,time);
      const textureDirection=sourceDirection(meta,logicalDirection);
      key=frameKey(action,textureDirection,frame);
      bottomPadding=framePadding(meta,logicalDirection,frame);
      flip=shouldMirror(meta,logicalDirection);
      this.visualAnimationState=action;
    }

    if(key!==this.currentPixelKey){
      this.pixelArt.setTexture(key);
      this.currentPixelKey=key;
    }
    this.pixelDirection=logicalDirection;

    // Ground the visible sprite, not the transparent canvas. Each new source
    // frame can be 168, 228, or 256 px tall, so the normalizer records the
    // transparent padding beneath the meaningful bottom edge of every frame.
    // Applying that padding at the unchanged 0.36 art scale puts the boots/body
    // exactly on the Arcade body's +24 px foot line without changing physics.
    this.pixelArt
      .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y+bottomPadding*ART_SCALE)
      .setOrigin(.5,1)
      .setScale(ART_SCALE)
      .setFlipX(flip)
      .setVisible(true);
    this.player.art.setVisible(false);
    this.animationWasGrounded=grounded;
  }
}
