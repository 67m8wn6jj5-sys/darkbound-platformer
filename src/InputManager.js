export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard?.addKeys({
      left:'A', right:'D', left2:'LEFT', right2:'RIGHT',
      jump:'SPACE', jump2:'W', jump3:'UP',
      dodge:'SHIFT', dodge2:'K',
      attack:'J', attack2:'F',
      restart:'R', pause:'ESC'
    }) ?? {};
    this.touch = { left:false, right:false, jumpPressed:false, jumpHeld:false, dodgePressed:false, attackPressed:false };
    this.lastSource = 'Touch';
    this.pad = null;
    this.nativePad = null;

    const gamepadPlugin = scene.input.gamepad;
    if (gamepadPlugin) {
      gamepadPlugin.on('connected', pad => {
        this.pad = pad;
        this.lastSource = 'Controller';
      });
      gamepadPlugin.on('disconnected', pad => {
        if (this.pad === pad) this.pad = null;
      });
    }
  }

  keyDown(name) {
    return !!this.keys?.[name]?.isDown;
  }

  keyPressed(name) {
    const key = this.keys?.[name];
    return !!key && Phaser.Input.Keyboard.JustDown(key);
  }

  pollNativePad() {
    if (typeof navigator.getGamepads !== 'function') {
      this.nativePad = null;
      return null;
    }
    const pads = navigator.getGamepads();
    this.nativePad = Array.from(pads || []).find(Boolean) || null;
    return this.nativePad;
  }

  getActivePad() {
    const gamepadPlugin = this.scene.input.gamepad;
    if (!this.pad && gamepadPlugin?.total) this.pad = gamepadPlugin.getPad(0);
    const nativePad = this.pollNativePad();
    return this.pad || nativePad;
  }

  axisValue(pad, index=0) {
    const axis = pad?.axes?.[index];
    if (typeof axis === 'number') return axis;
    return axis?.getValue?.() ?? 0;
  }

  buttonDown(pad, phaserName, nativeIndex) {
    if (!pad) return false;
    if (typeof pad?.[phaserName] === 'boolean') return pad[phaserName];
    return !!pad?.buttons?.[nativeIndex]?.pressed;
  }

  async rumble(duration=70, strongMagnitude=.65, weakMagnitude=.25) {
    const pad = this.pollNativePad();
    const actuator = pad?.vibrationActuator || pad?.hapticActuators?.[0];
    if (!actuator) return false;
    try {
      if (typeof actuator.playEffect === 'function') {
        await actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude,
          strongMagnitude
        });
        return true;
      }
      if (typeof actuator.pulse === 'function') {
        await actuator.pulse(Math.max(strongMagnitude, weakMagnitude), duration);
        return true;
      }
    } catch (_) {}
    return false;
  }

  update() {
    const pad = this.getActivePad();
    const rawAxis = this.axisValue(pad,0);
    const padAxis = Math.abs(rawAxis) > .18 ? rawAxis : 0;
    const padLeft = this.buttonDown(pad,'left',14) || padAxis < -.18;
    const padRight = this.buttonDown(pad,'right',15) || padAxis > .18;
    const padA = this.buttonDown(pad,'A',0);
    const padB = this.buttonDown(pad,'B',1);
    const padX = this.buttonDown(pad,'X',2);
    const padStart = this.buttonDown(pad,'start',9);
    const keyboardLeft = this.keyDown('left') || this.keyDown('left2');
    const keyboardRight = this.keyDown('right') || this.keyDown('right2');

    const keyboardActivity = keyboardLeft || keyboardRight || this.keyPressed('jump') || this.keyPressed('dodge') || this.keyPressed('attack');
    if (keyboardActivity) this.lastSource='Keyboard';
    if (padLeft || padRight || padA || padB || padX) this.lastSource='Controller';
    if (this.touch.left || this.touch.right || this.touch.jumpHeld || this.touch.dodgePressed || this.touch.attackPressed) this.lastSource='Touch';

    let move = 0;
    if (keyboardLeft || padLeft || this.touch.left) move -= 1;
    if (keyboardRight || padRight || this.touch.right) move += 1;
    move = Phaser.Math.Clamp(move + padAxis, -1, 1);

    const jumpPressed = this.keyPressed('jump')
      || this.keyPressed('jump2')
      || this.keyPressed('jump3')
      || (padA && !this._padA)
      || this.touch.jumpPressed;
    const jumpHeld = this.keyDown('jump') || this.keyDown('jump2') || this.keyDown('jump3') || padA || this.touch.jumpHeld;
    const dodgePressed = this.keyPressed('dodge')
      || this.keyPressed('dodge2')
      || (padB && !this._padB)
      || this.touch.dodgePressed;
    const attackPressed = this.keyPressed('attack')
      || this.keyPressed('attack2')
      || (padX && !this._padX)
      || this.touch.attackPressed;
    const restartPressed = this.keyPressed('restart') || attackPressed || jumpPressed;
    const pausePressed = this.keyPressed('pause') || (padStart && !this._padStart);

    this._padA=padA;
    this._padB=padB;
    this._padX=padX;
    this._padStart=padStart;
    this.touch.jumpPressed=false;
    this.touch.dodgePressed=false;
    this.touch.attackPressed=false;

    return { move, jumpPressed, jumpHeld, dodgePressed, attackPressed, restartPressed, pausePressed };
  }
}
