import { GameSceneV24 } from './GameSceneV24.js';
// GameSceneV24 extends GameSceneV23 -> GameSceneV22, preserving level-design, terrain, and combat foundations.

let game = null;
let startTimer = null;

function showStartupError(error) {
  console.error(error);
  const panel = document.getElementById('startup-error');
  if (!panel) return;
  panel.hidden = false;
  const message = panel.querySelector('[data-error-message]');
  if (message) message.textContent = error?.message || String(error);
}

function isPortraitPhone() {
  return window.matchMedia?.('(orientation: portrait) and (max-width: 900px)')?.matches === true;
}

function startGame() {
  if (game || isPortraitPhone()) return;
  if (!window.Phaser) {
    showStartupError(new Error('Phaser failed to load. Refresh the page and check your connection.'));
    return;
  }

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
    dom: { createContainer: true },
    scene: [GameSceneV24],
    render: { antialias: true, pixelArt: false }
  };

  game = new Phaser.Game(config);
  game.events.once('ready', () => {
    document.documentElement.dataset.gameReady = 'true';
    requestAnimationFrame(() => game?.scale?.refresh());
  });
}

function handleViewportChange() {
  clearTimeout(startTimer);
  startTimer = setTimeout(() => {
    if (isPortraitPhone()) return;
    if (!game) startGame();
    else game.scale.refresh();
  }, 220);
}

window.addEventListener('error', event => showStartupError(event.error || event.message));
window.addEventListener('unhandledrejection', event => showStartupError(event.reason));
window.addEventListener('orientationchange', handleViewportChange, { passive: true });
window.addEventListener('resize', handleViewportChange, { passive: true });
window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) handleViewportChange();
});

try {
  if (!isPortraitPhone()) startGame();
} catch (error) {
  showStartupError(error);
}
