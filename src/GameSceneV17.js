import { GameSceneV16 } from './GameSceneV16.js';
import { PIXELLAB_MANIFEST } from './pixellabManifest.js';

const ROOT='./assets/v05/pixellab_protagonist';
// The player's Arcade body is 54 px tall with offset (-14,-30), so its feet
// sit 24 px below the container origin when grounded. Anchor the artwork's
// bottom edge to that same point instead of using the old arbitrary +72 px.
const PLAYER_FEET_Y=24;
// The PixelLab source frames contain a much larger character than the original
// production sprites. Keep the physics body unchanged and only shrink artwork.
const ART_SCALE=.36;

function updatedKey(action,direction,index){
  return `px-update4-${action}-${direction}-${String(index).padStart(3,'0')}`;
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
            `${ROOT}/${action}/${direction}/frame_${String(i).padStart(3,'0')}.png?v=protagonist-update-4`
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
      .setPosition(this.player.x,this.player.y+PLAYER_FEET_Y)
      .setOrigin(.5,1)
      .setScale(ART_SCALE)
      .setVisible(true);
    this.player.art.setVisible(false);
  }
}
