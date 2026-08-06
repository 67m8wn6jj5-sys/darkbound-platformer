import { GameScene } from './GameScene.js';

function showStartupError(error) {
  console.error(error);
  const panel = document.getElementById('startup-error');
  if (!panel) return;
  panel.hidden = false;
  panel.querySelector('[data-error-message]').textContent = error?.message || String(error);
}

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
    input: { gamepad: true, activePointers: 5 },
    scene: [GameScene],
    render: { antialias: true, pixelArt: false }
  };

  const game = new Phaser.Game(config);
  game.events.once('ready', () => {
    document.documentElement.dataset.gameReady = 'true';
  });

  window.addEventListener('error', event => showStartupError(event.error || event.message));
  window.addEventListener('unhandledrejection', event => showStartupError(event.reason));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('../sw.js').catch(error => console.warn('Service worker unavailable:', error));
    });
  }
} catch (error) {
  showStartupError(error);
}
