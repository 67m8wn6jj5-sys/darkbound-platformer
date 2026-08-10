import { GameSceneV09 } from './GameSceneV09.js';

function showStartupError(error) {
  console.error(error);
  const panel = document.getElementById('startup-error');
  if (!panel) return;
  panel.hidden = false;
  const message = panel.querySelector('[data-error-message]');
  if (message) message.textContent = error?.message || String(error);
}

window.addEventListener('error', event => showStartupError(event.error || event.message));
window.addEventListener('unhandledrejection', event => showStartupError(event.reason));

try {
  if (!window.Phaser) throw new Error('Phaser failed to load. Refresh the page and check your connection.');

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#070910',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false }
    },
    input: {
      gamepad: typeof navigator.getGamepads === 'function',
      activePointers: 5
    },
    dom: {
      createContainer: true
    },
    scene: [GameSceneV09],
    render: { antialias: true, pixelArt: false }
  };

  const game = new Phaser.Game(config);

  // iOS Safari/PWA can report a transient 0-sized viewport while rotating.
  // Wait for the new viewport to settle, then explicitly resize and redraw
  // instead of leaving Phaser's RESIZE canvas black.
  let orientationResizeTimer = null;
  const recoverViewport = () => {
    clearTimeout(orientationResizeTimer);
    orientationResizeTimer = setTimeout(() => {
      const viewport = window.visualViewport;
      const width = Math.max(1, Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 1));
      const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1));
      const shell = document.getElementById('game-shell');
      const parent = document.getElementById('game');
      if (shell) shell.style.height = `${height}px`;
      if (parent) parent.style.height = `${height}px`;
      game.scale.resize(width, height);
      game.scale.refresh();
      const scene = game.scene.getScenes(true)[0];
      if (scene?.cameras?.main) {
        scene.cameras.main.setSize(width, height);
        scene.cameras.main.dirty = true;
      }
      game.renderer?.resize?.(width, height);
    }, 180);
  };

  window.addEventListener('orientationchange', recoverViewport, { passive: true });
  window.addEventListener('resize', recoverViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', recoverViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', recoverViewport, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recoverViewport();
  });

  game.events.once('ready', () => {
    document.documentElement.dataset.gameReady = 'true';
    recoverViewport();
  });
} catch (error) {
  showStartupError(error);
}
