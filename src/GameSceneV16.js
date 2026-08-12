import { GameSceneV15 } from './GameSceneV15.js';
import { GameSceneV14 } from './GameSceneV14.js';
import { BOSS1_MANIFEST } from './boss1Manifest.js';

const BOSS1_ROOT='./assets/v05/boss1';
const BOSS_ACTION_FPS=12;
const LUNGE_TOTAL_MS=Math.ceil((Math.max(BOSS1_MANIFEST?.lunge?.east||0,BOSS1_MANIFEST?.lunge?.west||0)/BOSS_ACTION_FPS)*1000);
const LUNGE_WINDUP_MS=300;

function bossKey(action,direction,index){
  return `boss1-${action}-${direction}-${String(index).padStart(3,'0')}`;
}

export class GameSceneV16 extends GameSceneV15 {
  preload(){
    // V15 only adds boss loading on top of V14. Call V14 directly here so we can
    // load the updated Boss1.zip frames with a fresh cache version on mobile.
    GameSceneV14.prototype.preload.call(this);
    for(const [action,meta] of Object.entries(BOSS1_MANIFEST)){
      if(!meta||typeof meta!=='object')continue;
      for(const direction of ['east','west']){
        const count=meta?.[direction]||0;
        for(let i=0;i<count;i++){
          this.load.image(
            bossKey(action,direction,i),
            `${BOSS1_ROOT}/${action}/${direction}/frame_${String(i).padStart(3,'0')}.png?v=boss1-2`
          );
        }
      }
    }
  }

  bossActionForState(state){
    // Let the supplied lunge animation span both the telegraph and the actual
    // forward burst instead of starting after the windup has already finished.
    if(state?.startsWith('lunge')&&BOSS1_MANIFEST.lunge)return 'lunge';
    return super.bossActionForState(state);
  }

  setBossState(enemy,state,time,duration=0){
    // A 9-frame lunge at 12 fps needs ~750 ms total. The original state machine
    // only allowed 660 ms (300 ms windup + 360 ms burst), clipping the ending.
    if(state==='lunge'){
      const neededBurst=Math.max(0,LUNGE_TOTAL_MS-LUNGE_WINDUP_MS);
      duration=Math.max(duration,neededBurst);
    }

    enemy.state=state;
    enemy.stateEndsAt=duration?time+duration:0;

    // Do not force-restart an animation when moving between physical substates
    // that share the same artwork (slamWindup -> slamRise -> slamFall, etc.).
    // This lets PixelLab's full 9-frame Jump/Slam sequence play continuously.
    this.setBossAnim(enemy,this.bossActionForState(state),time,false);
  }
}
