import { GameSceneV09 } from './GameSceneV09.js';

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

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function startGame() {
  if (game || isPortraitPhone()) return;
  if (!window.Phaser) {
    showStartupError(new Error('Phaser failed to load. Refresh the page and check your connection.'));
    return;
  }

  const config = {
    type: isIOS() ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#070910',
    width: 1280,
    height: 720,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
      expandParent: true
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
    scene: [GameSceneV09],
    render: {
      antialias: true,
      pixelArt: false,
      clearBeforeRender: true
    }
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
    if (isPortraitPhone()) {
      if (game) {
        game.destroy(true);
        game = null;
        document.documentElement.dataset.gameReady = 'false';
      }
      return;
    }

    if (!game) startGame();
    else game.scale.refresh();
  }, 350);
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
