export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard?.addKeys({
      left:'A', right:'D', left2:'LEFT', right2:'RIGHT',
      jump:'SPACE', jump2:'W', jump3:'UP', dodge:'SHIFT', dodge2:'K', pause:'ESC'
    }) ?? {};
    this.touch = { left:false, right:false, jumpPressed:false, jumpHeld:false, dodgePressed:false };
    this.lastSource = 'Touch';
    this.pad = null;

    const gamepadPlugin = scene.input.gamepad;
    if (gamepadPlugin) {
      gamepadPlugin.once('connected', pad => {
        this.pad = pad;
        this.lastSource = 'Controller';
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

  update() {
    const gamepadPlugin = this.scene.input.gamepad;
    if (!this.pad && gamepadPlugin?.total) this.pad = gamepadPlugin.getPad(0);

    const axis0 = this.pad?.axes?.[0];
    const rawAxis = axis0?.getValue?.() ?? 0;
    const padAxis = Math.abs(rawAxis) > .18 ? rawAxis : 0;
    const padLeft = !!this.pad?.left || padAxis < -.18;
    const padRight = !!this.pad?.right || padAxis > .18;
    const keyboardLeft = this.keyDown('left') || this.keyDown('left2');
    const keyboardRight = this.keyDown('right') || this.keyDown('right2');

    if (keyboardLeft || keyboardRight || this.keyPressed('jump') || this.keyPressed('dodge')) this.lastSource='Keyboard';
    if (padLeft || padRight || this.pad?.A || this.pad?.B) this.lastSource='Controller';
    if (this.touch.left || this.touch.right || this.touch.jumpHeld || this.touch.dodgePressed) this.lastSource='Touch';

    let move = 0;
    if (keyboardLeft || padLeft || this.touch.left) move -= 1;
    if (keyboardRight || padRight || this.touch.right) move += 1;
    move = Phaser.Math.Clamp(move + padAxis, -1, 1);

    const jumpPressed = this.keyPressed('jump')
      || this.keyPressed('jump2')
      || this.keyPressed('jump3')
      || (!!this.pad?.A && !this._padA)
      || this.touch.jumpPressed;
    const jumpHeld = this.keyDown('jump') || this.keyDown('jump2') || this.keyDown('jump3') || !!this.pad?.A || this.touch.jumpHeld;
    const dodgePressed = this.keyPressed('dodge')
      || this.keyPressed('dodge2')
      || (!!this.pad?.B && !this._padB)
      || this.touch.dodgePressed;
    const startPressed = !!this.pad?.buttons?.[9]?.pressed;
    const pausePressed = this.keyPressed('pause') || (startPressed && !this._padStart);

    this._padA=!!this.pad?.A;
    this._padB=!!this.pad?.B;
    this._padStart=startPressed;
    this.touch.jumpPressed=false;
    this.touch.dodgePressed=false;

    return { move, jumpPressed, jumpHeld, dodgePressed, pausePressed };
  }
}
