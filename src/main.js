import { GameSceneV38 } from './GameSceneV38.js';
import './GameSceneV48.js?v=v48-cathedral-bounds-root-fix-20260827-1';
import './GameSceneV49.js?v=v49-grounding-scale-calibration-20260827-1';
import './GameSceneV51.js?v=v51-canonical-protagonist-size-20260827-1';
import './GameSceneV54.js?v=v54-protagonist-size-normalization-20260827-1';
import './GameSceneV55.js?v=v55-clean-production-presentation-20260828-1';
// Live chain: GameSceneV38 -> GameSceneV37 -> GameSceneV36 -> GameSceneV35 -> GameSceneV34 -> GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29 -> GameSceneV28 -> GameSceneV27 -> GameSceneV26 -> GameSceneV25 -> GameSceneV24 -> GameSceneV23 -> GameSceneV22 -> GameSceneV21 -> GameSceneV20 -> GameSceneV19 -> GameSceneV18.
// V48 fixes the inherited short-world bounds that clamped the cathedral player.
// V49 aligns cathedral physics with rendered terrain.
// V51 removes the oversized 8-direction turn poses during normal side-scrolling.
// V54 normalizes protagonist scale while preserving approved death grounding.
// V55 removes legacy screen-locked texture/fog overlays; only localized,
// spatially motivated presentation effects remain.

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
    scene: [GameSceneV38],
    render: { antialias: true, pixelArt: false }
  };

  game = new Phaser.Game(config);
  game.events.once('ready', () => {
    document.documentElement.dataset.gameReady = 'true';
    document.documentElement.dataset.build='v55';
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
