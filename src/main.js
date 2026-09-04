import { GameSceneV38 } from './GameSceneV38.js';
import './GameSceneV48.js?v=v48-cathedral-bounds-root-fix-20260827-1';
import './GameSceneV49.js?v=v49-grounding-scale-calibration-20260827-1';
import './GameSceneV51.js?v=v51-canonical-protagonist-size-20260827-1';
import './GameSceneV55.js?v=v55-clean-production-presentation-20260828-1';
import './GameSceneV56.js?v=v56-remove-screen-space-bands-20260828-1';
import './GameSceneV57.js?v=v57-protagonist-consistency-20260903-1';
import './GameSceneV58.js?v=v58-combat-correctness-20260903-1';
import './GameSceneV59.js?v=v59-blade-tracked-collision-20260904-1';
import './GameSceneV60.js?v=v60-cathedral-jump-reach-20260904-1';
// Live chain: GameSceneV38 -> GameSceneV37 -> GameSceneV36 -> GameSceneV35 -> GameSceneV34 -> GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29 -> GameSceneV28 -> GameSceneV27 -> GameSceneV26 -> GameSceneV25 -> GameSceneV24 -> GameSceneV23 -> GameSceneV22 -> GameSceneV21 -> GameSceneV20 -> GameSceneV19 -> GameSceneV18.
// V48 fixes the inherited short-world bounds that clamped the cathedral player.
// V49 aligns cathedral physics with rendered terrain.
// V51 removes the oversized 8-direction turn poses during normal side-scrolling.
// V55/V56 remove legacy screen-space texture/fog bands.
// V57 is the approved protagonist presentation baseline: canonical living scale,
// mirrored canonical idle/run art, stabilized run grounding, preserved death contact.
// V58 is combat-only: attack/dodge/hit exclusivity, spatial boss slam damage,
// committed boss lunge timing, and type-safe boss dash damage.
// V59 makes sword damage follow V27's authored blade root/tip anchors and sweeps
// between animation frames instead of using the original forward-range box.
// V60 raises full-hold jump reach enough to clear the cathedral's 128px route
// steps while preserving the existing variable-height short-hop behavior.

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
      default: Phaser.AUTO,
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
    document.documentElement.dataset.build='v60';
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
