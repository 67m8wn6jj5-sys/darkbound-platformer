import { GameSceneV16 } from './GameSceneV16.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const ROOT='./assets/v05/pixellab_protagonist';
const ART_Y=72;
const ART_SCALE=.595;

function updatedKey(action,direction,index){
  return `px-update3-${action}-${direction}-${String(index).padStart(3,'0')}`;
}

export class GameSceneV17 extends GameSceneV16 {
  preload(){
    super.preload();
    // Load the newest normalized protagonist set under fresh texture keys so
    // mobile browsers cannot reuse previous protagonist frames from cache.
    for(const [action,meta] of Object.entries(PIXELLAB_MANIFEST)){
      if(!meta||typeof meta!=='object')continue;
      for(const direction of ['east','west']){
        const count=meta?.[direction]||0;
        for(let i=0;i<count;i++){
          this.load.image(
            updatedKey(action,direction,i),
            `${ROOT}/${action}/${direction}/frame_${String(i).padStart(3,'0')}.png?v=protagonist-update-3`
          );
        }
      }
    }
  }

  updatePixelArt(time){
    if(!this.pixelArt)return;
    const action=this.resolvePixelState(time);
    this.setPixelState(action,time);
    const direction=this.facing<0?'west':'east';
    if(direction!==this.pixelDirection){
      this.pixelDirection=direction;
      this.currentPixelKey='';
    }
    const frame=this.frameForState(action,direction,time);
    const key=updatedKey(action,direction,frame);
    if(key!==this.currentPixelKey){
      this.pixelArt.setTexture(key);
      this.currentPixelKey=key;
    }
    this.pixelArt
      .setPosition(this.player.x,this.player.y+ART_Y)
      .setOrigin(.5,1)
      .setScale(ART_SCALE)
      .setVisible(true);
    this.player.art.setVisible(false);
  }
}
