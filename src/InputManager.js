export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys({
      left:'A', right:'D', left2:'LEFT', right2:'RIGHT',
      jump:'SPACE', jump2:'W', jump3:'UP', dodge:'SHIFT', dodge2:'K', pause:'ESC'
    });
    this.touch = { left:false, right:false, jumpPressed:false, jumpHeld:false, dodgePressed:false };
    this.lastSource = 'Keyboard';
    this.pad = null;

    // Safari may not expose the gamepad plugin until after a user gesture.
    // Guard every access so touch play still starts normally.
    if (scene.input.gamepad) {
      scene.input.gamepad.once('connected', pad => {
        this.pad = pad;
        this.lastSource = 'Controller';
      });
    }
  }

  update() {
    const gamepadPlugin = this.scene.input.gamepad;
    if (!this.pad && gamepadPlugin?.total) this.pad = gamepadPlugin.getPad(0);

    const k = this.keys;
    const axis0 = this.pad?.axes?.[0];
    const rawAxis = axis0?.getValue?.() ?? 0;
    const padAxis = Math.abs(rawAxis) > .18 ? rawAxis : 0;
    const padLeft = !!this.pad?.left || padAxis < -.18;
    const padRight = !!this.pad?.right || padAxis > .18;
    const keyboardLeft = k.left.isDown || k.left2.isDown;
    const keyboardRight = k.right.isDown || k.right2.isDown;

    if (keyboardLeft || keyboardRight || Phaser.Input.Keyboard.JustDown(k.jump) || Phaser.Input.Keyboard.JustDown(k.dodge)) this.lastSource='Keyboard';
    if (padLeft || padRight || this.pad?.A || this.pad?.B) this.lastSource='Controller';
    if (this.touch.left || this.touch.right || this.touch.jumpHeld || this.touch.dodgePressed) this.lastSource='Touch';

    let move = 0;
    if (keyboardLeft || padLeft || this.touch.left) move -= 1;
    if (keyboardRight || padRight || this.touch.right) move += 1;
    move = Phaser.Math.Clamp(move + padAxis, -1, 1);

    const jumpPressed = Phaser.Input.Keyboard.JustDown(k.jump)
      || Phaser.Input.Keyboard.JustDown(k.jump2)
      || Phaser.Input.Keyboard.JustDown(k.jump3)
      || (!!this.pad?.A && !this._padA)
      || this.touch.jumpPressed;
    const jumpHeld = k.jump.isDown || k.jump2.isDown || k.jump3.isDown || !!this.pad?.A || this.touch.jumpHeld;
    const dodgePressed = Phaser.Input.Keyboard.JustDown(k.dodge)
      || Phaser.Input.Keyboard.JustDown(k.dodge2)
      || (!!this.pad?.B && !this._padB)
      || this.touch.dodgePressed;
    const startPressed = !!this.pad?.buttons?.[9]?.pressed;
    const pausePressed = Phaser.Input.Keyboard.JustDown(k.pause) || (startPressed && !this._padStart);

    this._padA=!!this.pad?.A;
    this._padB=!!this.pad?.B;
    this._padStart=startPressed;
    this.touch.jumpPressed=false;
    this.touch.dodgePressed=false;

    return { move, jumpPressed, jumpHeld, dodgePressed, pausePressed };
  }
}
