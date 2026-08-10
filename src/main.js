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

function viewportSize() {
  const viewport = window.visualViewport;
  return {
    width: Math.max(1, Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 1)),
    height: Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 1))
  };
}

function resizeGame() {
  if (!game || isPortraitPhone()) return;
  const { width, height } = viewportSize();
  const shell = document.getElementById('game-shell');
  const parent = document.getElementById('game');
  if (shell) shell.style.height = `${height}px`;
  if (parent) parent.style.height = `${height}px`;
  game.scale.resize(width, height);
  game.scale.refresh();
  game.renderer?.resize?.(width, height);
  for (const scene of game.scene.getScenes(true)) {
    scene.cameras?.main?.setSize(width, height);
  }
}

function startGame() {
  if (game || isPortraitPhone()) return;
  if (!window.Phaser) {
    showStartupError(new Error('Phaser failed to load. Refresh the page and check your connection.'));
    return;
  }

  const { width, height } = viewportSize();
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#070910',
    width,
    height,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height
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
    render: { antialias: true, pixelArt: false }
  };

  game = new Phaser.Game(config);
  game.events.once('ready', () => {
    document.documentElement.dataset.gameReady = 'true';
    requestAnimationFrame(() => requestAnimationFrame(resizeGame));
  });
}

function handleViewportChange() {
  clearTimeout(startTimer);
  startTimer = setTimeout(() => {
    if (isPortraitPhone()) return;
    if (!game) startGame();
    else resizeGame();
  }, 280);
}

window.addEventListener('error', event => showStartupError(event.error || event.message));
window.addEventListener('unhandledrejection', event => showStartupError(event.reason));
window.addEventListener('orientationchange', handleViewportChange, { passive: true });
window.addEventListener('resize', handleViewportChange, { passive: true });
window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });
window.visualViewport?.addEventListener('scroll', handleViewportChange, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) handleViewportChange();
});

try {
  // Critical iPhone behavior: never create the WebGL/Phaser canvas while the
  // rotate-to-landscape overlay is active. Starting fresh after landscape is
  // established avoids the black canvas state seen after portrait startup.
  if (!isPortraitPhone()) startGame();
} catch (error) {
  showStartupError(error);
}
