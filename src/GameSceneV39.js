import { GameSceneV38 } from './GameSceneV38.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const ROOT='./assets/v05/pixellab_protagonist';
const CACHE_BUST='protagonist-v39-rescue-20260823-2';
const RESCUE_PREFIX='v39-';

function frameKey(action,direction,index){
  return `px-${action}-${direction}-${String(index).padStart(3,'0')}`;
}
function rescueFrameKey(action,direction,index){return `${RESCUE_PREFIX}${frameKey(action,direction,index)}`;}
function rotationKey(source,direction){return `px-rotation-${source}-${direction}`;}
function rescueRotationKey(source,direction){return `${RESCUE_PREFIX}${rotationKey(source,direction)}`;}

export class GameSceneV39 extends GameSceneV38 {
  preload(){
    super.preload();
    const loadedRotations=new Set();
    for(const [action,meta] of Object.entries(PIXELLAB_MANIFEST)){
      if(!meta||typeof meta!=='object')continue;
      for(const direction of ['east','west']){
        const count=Math.max(0,Number(meta?.[direction])||0);
        for(let index=0;index<count;index++){
          const file=`frame_${String(index).padStart(3,'0')}.png`;
          this.load.image(
            rescueFrameKey(action,direction,index),
            `${ROOT}/${action}/${direction}/${file}?v=${CACHE_BUST}`,
          );
        }
      }
      const source=meta.rotationSource||action;
      for(const direction of meta.rotations||[]){
        const identity=`${source}:${direction}`;
        if(loadedRotations.has(identity))continue;
        loadedRotations.add(identity);
        this.load.image(
          rescueRotationKey(source,direction),
          `${ROOT}/${source}/rotations/${direction}.png?v=${CACHE_BUST}`,
        );
      }
    }
  }

  repairProtagonistRenderV39(){
    if(!this.player)return;
    this.player.setVisible?.(true).setActive?.(true).setDepth?.(90);
    const art=this.pixelArt;
    if(!art)return;

    const canonical=this.currentPixelKey||'';
    const rescue=canonical?`${RESCUE_PREFIX}${canonical}`:'';
    if(rescue&&this.textures?.exists?.(rescue)&&art.texture?.key!==rescue){
      art.setTexture(rescue);
    }

    art.setVisible(true).setActive(true).setDepth(300).setScrollFactor(1,1);
    if(!this.dead&&art.alpha<=.01)art.setAlpha(1);
  }

  create(){
    super.create();
    this.repairProtagonistRenderV39();
  }

  updatePixelArt(time){
    super.updatePixelArt(time);
    this.repairProtagonistRenderV39();
  }

  update(time,delta){
    super.update(time,delta);
    this.repairProtagonistRenderV39();
  }
}
