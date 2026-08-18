import { GameSceneV16 } from './GameSceneV16.js';
import { TUNING } from './config.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const ROOT='./assets/v05/pixellab_protagonist';
const PLAYER_FEET_Y=24;
// 0.396 is exactly 10% larger than the previous 0.36 production scale.
// Grounding stays frame-aware because all padding offsets are multiplied by
// this same scale before the visible bottom is placed on PLAYER_FEET_Y.
const ART_SCALE=.396;
const VFX_GREEN=0x43ff57;
const VFX_GREEN_HOT=0xbfff8f;
const VFX_GREEN_CORE=0xf2ffe1;

const ROTATION_RING=Object.freeze(['east','south-east','south','south-west','west','north-west','north','north-east']);
const TURN_STEP_MS=18;
const LANDING_MS=180;
const TURN_ELIGIBLE=new Set(['idle','run','jump','fall','land']);
const ATTACK_VISUAL_PHASES=Object.freeze({
  // Each combo step owns a different approved source sequence. These contact
  // windows are mapped onto the existing gameplay hitbox timing.
  attack_1:{activeFirst:2,activeLast:6},
  attack_2:{activeFirst:4,activeLast:6},
  attack_3:{activeFirst:4,activeLast:6},
});

// Particle anchors are authored in source-sprite pixels relative to the player
// foot line. Multiplying them by ART_SCALE keeps the effects attached if the
// protagonist art scale changes again. The three attacks intentionally use
// different paths that follow the corresponding sword motion in the new art.
const ATTACK_FX_PROFILES=Object.freeze({
  attack_1:{
    2:{x:58,y:-60,angle:-48,length:142,width:9,travelX:28,travelY:-10,intensity:1},
    3:{x:24,y:-86,angle:-10,length:150,width:9,travelX:18,travelY:-12,intensity:1},
    4:{x:10,y:-78,angle:12,length:148,width:9,travelX:22,travelY:4,intensity:1},
    5:{x:38,y:-54,angle:18,length:164,width:10,travelX:34,travelY:14,intensity:1.08},
    6:{x:88,y:-14,angle:8,length:176,width:10,travelX:48,travelY:18,intensity:1.12},
  },
  attack_2:{
    4:{x:18,y:-30,angle:8,length:150,width:10,travelX:26,travelY:6,intensity:1.05},
    5:{x:72,y:-12,angle:15,length:190,width:11,travelX:56,travelY:14,intensity:1.16},
    6:{x:96,y:8,angle:2,length:172,width:10,travelX:44,travelY:7,intensity:1.1},
  },
  attack_3:{
    4:{x:-12,y:-82,angle:-42,length:188,width:13,travelX:26,travelY:18,intensity:1.2},
    5:{x:62,y:-36,angle:34,length:228,width:15,travelX:72,travelY:42,intensity:1.4},
    6:{x:98,y:18,angle:54,length:184,width:13,travelX:54,travelY:34,intensity:1.3},
  },
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

function mirroredAngle(angle,facing){
  return facing>0?angle:180-angle;
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
          `${ROOT}/${source}/rotations/${direction}.png?v=protagonist-20260818-2`
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
    this.lastAttackFxToken='';
    this.queuedAttackCount=0;

    if(this.pixelArt){
      const initialPadding=framePadding(PIXELLAB_MANIFEST.idle,logical,0);
      this.pixelArt
        .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y+initialPadding*ART_SCALE)
        .setOrigin(.5,1)
        .setScale(ART_SCALE);
    }
  }

  attackActionForStep(step=this.comboStep){
    return `attack_${Math.max(1,Math.min(3,(Number(step)||0)+1))}`;
  }

  resolvePixelState(time){
    const body=this.player?.body;
    if(!body)return'idle';
    if(this.dead)return'death';
    if(time<this.hitAnimEndsAt)return'hit';
    if(this.state?.startsWith('attack-'))return this.attackActionForStep();
    if(this.state==='rolling')return'dash';
    if(!body.blocked.down)return body.velocity.y<0?'jump':'fall';
    if(time<this.landingEndsAt)return'land';
    if(this.state==='running')return'run';
    return'idle';
  }

  // V05 still owns the shared combat lunge/recoil behavior. Its legacy
  // spawnSwordFlare() call dynamically dispatches here, so intentionally make
  // the start-of-attack flare a no-op: V17 emits particles from the actual
  // rendered attack frames instead of from an old hard-coded sprite offset.
  spawnSwordFlare(){}

  startAttack(time,step=null){
    super.startAttack(time,step);
    const action=this.attackActionForStep();
    // Explicitly reset to the correct one of the three approved sequences on
    // every combo transition, including queued chains.
    this.setPixelState(action,time,true);
    this.lastAttackFxToken='';
    this.attackQueued=this.queuedAttackCount>0;
  }

  // The base game stores only one queued attack as a boolean. On a fast triple
  // tap, the second and third presses can therefore collapse into one queue
  // entry. Keep up to two buffered presses so a rapid 1-2-3 input reliably
  // plays all three distinct approved attack animations in order.
  queueAttack(time){
    if(time<this.attackStartsAt||time>this.attackEndsAt+TUNING.attackInputBufferMs)return;
    this.queuedAttackCount=Math.min(2,(this.queuedAttackCount||0)+1);
    this.attackQueued=this.queuedAttackCount>0;
  }

  finishOrChainAttack(time){
    if(time<this.attackEndsAt)return true;
    if((this.queuedAttackCount||0)>0||this.attackQueued){
      if((this.queuedAttackCount||0)>0)this.queuedAttackCount--;
      this.attackQueued=this.queuedAttackCount>0;
      this.startAttack(time,(this.comboStep+1)%3);
      return true;
    }
    this.attackQueued=false;
    this.attackFlash.setVisible(false);
    this.attackArc.setVisible(false);
    this.player.weapon.setAngle(0);
    return false;
  }

  // Reproduce V05's roll gameplay exactly, but remove its old fixed-position
  // initial particle burst. The first trail is now anchored to the dash pose.
  startRoll(time,body){
    this.lastRollAt=time;
    this.rollEndsAt=time+TUNING.rollDurationMs;
    this.state='rolling';
    body.setVelocityX(this.facing*TUNING.rollSpeed);
    this.tweens.killTweensOf(this.player);
    this.player.setAlpha(1);
    this.setPixelState('dash',time,true);
    this.spawnDashTrail(true);
    this.nextDashTrailAt=time+28;
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

  emitAttackMotionFx(action,frame,time){
    const profile=ATTACK_FX_PROFILES[action]?.[frame];
    if(!profile)return;
    const token=`${this.attackStartsAt}:${action}:${frame}`;
    if(token===this.lastAttackFxToken)return;
    this.lastAttackFxToken=token;

    const facing=this.facing<0?-1:1;
    const x=this.player.x+facing*profile.x*ART_SCALE;
    const y=this.player.y+PLAYER_FEET_Y+profile.y*ART_SCALE;
    const angle=mirroredAngle(profile.angle,facing);
    const radians=angle*Math.PI/180;
    const normalX=Math.cos(radians+Math.PI/2);
    const normalY=Math.sin(radians+Math.PI/2);
    const length=profile.length*ART_SCALE;
    const width=Math.max(2,profile.width*ART_SCALE);
    const intensity=profile.intensity||1;
    const colors=[VFX_GREEN,VFX_GREEN_HOT,VFX_GREEN_CORE];

    for(let i=0;i<3;i++){
      const offset=(i-1)*4*ART_SCALE;
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
        x:streak.x+facing*profile.travelX*ART_SCALE,
        y:streak.y+profile.travelY*ART_SCALE,
        scaleX:1.08+intensity*.12,
        scaleY:.08,
        alpha:0,
        duration:Math.round(82+32*intensity+i*16),
        ease:'Quad.easeOut',
        onComplete:()=>streak.destroy()
      });
    }

    const tipX=x+Math.cos(radians)*length*.48;
    const tipY=y+Math.sin(radians)*length*.48;
    const sparkCount=action==='attack_3'?7:4;
    for(let i=0;i<sparkCount;i++){
      const spark=this.add.circle(
        tipX+Phaser.Math.Between(-3,3),
        tipY+Phaser.Math.Between(-3,3),
        Phaser.Math.Between(1,3),
        i%3===0?VFX_GREEN_CORE:VFX_GREEN_HOT,
        .92
      ).setDepth(114).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:spark,
        x:spark.x+facing*Phaser.Math.Between(10,28)*intensity,
        y:spark.y+Phaser.Math.Between(-12,12)*intensity,
        alpha:0,
        scale:.08,
        duration:Phaser.Math.Between(95,165),
        ease:'Quad.easeOut',
        onComplete:()=>spark.destroy()
      });
    }
  }

  spawnDashTrail(initial=false){
    const facing=this.facing<0?-1:1;
    // New dash art leans forward with the cape extending behind the torso. Keep
    // the trail centered behind the shoulder/torso rather than the old canvas Y.
    const backX=this.player.x-facing*88*ART_SCALE;
    const torsoY=this.player.y+PLAYER_FEET_Y-70*ART_SCALE;
    const streakCount=initial?5:3;
    for(let i=0;i<streakCount;i++){
      const y=torsoY+Phaser.Math.Between(-30,30)*ART_SCALE;
      const length=Phaser.Math.Between(105,175)*ART_SCALE;
      const streak=this.add.rectangle(
        backX,y,length,Phaser.Math.Between(7,15)*ART_SCALE,
        i%3===0?VFX_GREEN_CORE:i%2===0?VFX_GREEN:VFX_GREEN_HOT,
        initial?.7:.48
      ).setOrigin(facing>0?1:0,.5).setDepth(94).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:streak,
        x:backX-facing*Phaser.Math.Between(110,185)*ART_SCALE,
        scaleX:1.75,
        scaleY:.18,
        alpha:0,
        duration:initial?210:170,
        ease:'Quad.easeOut',
        onComplete:()=>streak.destroy()
      });
    }

    const floorY=this.player.y+PLAYER_FEET_Y-2;
    for(let i=0;i<(initial?6:3);i++){
      const fleck=this.add.circle(
        this.player.x-facing*Phaser.Math.Between(30,80)*ART_SCALE,
        floorY-Phaser.Math.Between(0,12)*ART_SCALE,
        Phaser.Math.Between(1,3),
        VFX_GREEN_HOT,.8
      ).setDepth(95).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets:fleck,
        x:fleck.x-facing*Phaser.Math.Between(55,125)*ART_SCALE,
        y:fleck.y-Phaser.Math.Between(2,18)*ART_SCALE,
        alpha:0,
        scale:.1,
        duration:Phaser.Math.Between(120,205),
        onComplete:()=>fleck.destroy()
      });
    }
  }

  spawnLandingBurst(){
    // Landing frames crouch directly onto the floor. Emit the burst from the
    // physics foot line so it stays under the boots after the 10% scale-up.
    const x=this.player.x;
    const y=this.player.y+PLAYER_FEET_Y;
    for(const direction of[-1,1]){
      for(let i=0;i<3;i++){
        const streak=this.add.rectangle(
          x,y-i*2,Math.round((48+i*18)*ART_SCALE),Math.max(2,(7+i*2)*ART_SCALE),
          i===2?VFX_GREEN_CORE:VFX_GREEN_HOT,.65
        ).setOrigin(direction<0?1:0,.5).setDepth(96).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets:streak,
          x:x+direction*(72+i*25)*ART_SCALE,
          scaleX:1.8,
          scaleY:.12,
          alpha:0,
          duration:190+i*25,
          ease:'Quad.easeOut',
          onComplete:()=>streak.destroy()
        });
      }
    }
    for(let i=0;i<10;i++){
      const mote=this.add.circle(
        x+Phaser.Math.Between(-16,16)*ART_SCALE,
        y-Phaser.Math.Between(0,10)*ART_SCALE,
        Phaser.Math.Between(1,3),
        i%3===0?VFX_GREEN_CORE:VFX_GREEN_HOT,.8
      ).setDepth(97).setBlendMode(Phaser.BlendModes.ADD);
      const direction=i%2===0?-1:1;
      this.tweens.add({
        targets:mote,
        x:mote.x+direction*Phaser.Math.Between(25,70)*ART_SCALE,
        y:mote.y-Phaser.Math.Between(8,28)*ART_SCALE,
        alpha:0,
        scale:.08,
        duration:Phaser.Math.Between(150,240),
        ease:'Quad.easeOut',
        onComplete:()=>mote.destroy()
      });
    }
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
    let frame=-1;

    if(TURN_ELIGIBLE.has(action)){
      const turning=this.beginOrUpdateTurn(logicalDirection,time);
      if(turning){
        const source=meta?.rotationSource||action;
        key=rotationKey(source,this.visualDirection);
        bottomPadding=Number(meta?.rotationBottomPadding?.[this.visualDirection])||0;
        this.visualAnimationState='turning';
      }else{
        this.visualDirection=logicalDirection;
        frame=this.frameForState(action,logicalDirection,time);
        const textureDirection=sourceDirection(meta,logicalDirection);
        key=frameKey(action,textureDirection,frame);
        bottomPadding=framePadding(meta,logicalDirection,frame);
        flip=shouldMirror(meta,logicalDirection);
        this.visualAnimationState=action;
      }
    }else{
      this.cancelTurn(logicalDirection);
      frame=this.frameForState(action,logicalDirection,time);
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

    // Ground the visible sprite, not the transparent canvas. This remains exact
    // after scaling up because bottomPadding uses the same ART_SCALE as the art.
    this.pixelArt
      .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y+bottomPadding*ART_SCALE)
      .setOrigin(.5,1)
      .setScale(ART_SCALE)
      .setFlipX(flip)
      .setVisible(true);
    this.player.art.setVisible(false);

    if(action.startsWith('attack_')&&frame>=0)this.emitAttackMotionFx(action,frame,time);
    this.animationWasGrounded=grounded;
  }
}
