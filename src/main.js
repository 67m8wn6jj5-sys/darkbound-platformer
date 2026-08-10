import { GameSceneV09 } from './GameSceneV09.js';

let game = null;
let startTimer = null;
let diagTimer = null;

function showStartupError(error) {
  console.error(error);
  const panel = document.getElementById('startup-error');
  if (!panel) return;
  panel.hidden = false;
  const message = panel.querySelector('[data-error-message]');
  if (message) message.textContent = error?.message || String(error);
}

function ensureDiagnostics() {
  let panel = document.getElementById('rotation-diagnostics');
  if (panel) return panel;
  panel = document.createElement('pre');
  panel.id = 'rotation-diagnostics';
  panel.style.cssText = [
    'position:fixed','left:8px','top:8px','z-index:5000','margin:0','padding:8px 10px',
    'max-width:calc(100vw - 16px)','white-space:pre-wrap','font:11px/1.35 monospace',
    'color:#9effb8','background:#000d','border:1px solid #3a6','border-radius:8px',
    'pointer-events:none','user-select:text'
  ].join(';');
  document.body.appendChild(panel);
  return panel;
}

function isPortraitPhone() {
  return window.matchMedia?.('(orientation: portrait) and (max-width: 900px)')?.matches === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function diagnosticText(stage = '') {
  const vv = window.visualViewport;
  const canvas = document.querySelector('#game canvas');
  const parent = document.getElementById('game');
  const scenes = game?.scene?.getScenes?.(true) || [];
  const rendererName = game?.renderer?.type === Phaser.CANVAS ? 'CANVAS' : game?.renderer?.type === Phaser.WEBGL ? 'WEBGL' : String(game?.renderer?.type ?? 'none');
  return [
    `Darkbound rotation diagnostic`,
    `stage: ${stage}`,
    `portraitPhone: ${isPortraitPhone()}`,
    `inner: ${window.innerWidth}x${window.innerHeight}`,
    `visualViewport: ${Math.round(vv?.width || 0)}x${Math.round(vv?.height || 0)}`,
    `screen: ${screen.width}x${screen.height}`,
    `Phaser: ${!!window.Phaser}`,
    `game: ${!!game}`,
    `renderer: ${rendererName}`,
    `activeScenes: ${scenes.map(s => s.scene?.key || '?').join(',') || 'none'}`,
    `canvas: ${canvas ? `${canvas.width}x${canvas.height} css=${Math.round(canvas.getBoundingClientRect().width)}x${Math.round(canvas.getBoundingClientRect().height)} display=${getComputedStyle(canvas).display}` : 'missing'}`,
    `parent: ${parent ? `${Math.round(parent.getBoundingClientRect().width)}x${Math.round(parent.getBoundingClientRect().height)}` : 'missing'}`,
    `readyFlag: ${document.documentElement.dataset.gameReady || 'unset'}`
  ].join('\n');
}

function updateDiagnostics(stage = '') {
  if (isPortraitPhone()) return;
  const panel = ensureDiagnostics();
  panel.textContent = diagnosticText(stage);
}

function startDiagnosticLoop(stage = '') {
  clearInterval(diagTimer);
  updateDiagnostics(stage);
  diagTimer = setInterval(() => updateDiagnostics('live'), 500);
}

function startGame() {
  if (game || isPortraitPhone()) return;
  startDiagnosticLoop('before-start');
  if (!window.Phaser) {
    showStartupError(new Error('Phaser failed to load. Refresh the page and check your connection.'));
    updateDiagnostics('phaser-missing');
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

  try {
    game = new Phaser.Game(config);
    updateDiagnostics('game-created');
    game.events.once('ready', () => {
      document.documentElement.dataset.gameReady = 'true';
      requestAnimationFrame(() => game?.scale?.refresh());
      updateDiagnostics('game-ready');
    });
  } catch (error) {
    updateDiagnostics(`constructor-error: ${error?.message || error}`);
    throw error;
  }
}

function handleViewportChange() {
  clearTimeout(startTimer);
  startTimer = setTimeout(() => {
    if (isPortraitPhone()) {
      const diag = document.getElementById('rotation-diagnostics');
      if (diag) diag.remove();
      clearInterval(diagTimer);
      if (game) {
        game.destroy(true);
        game = null;
        document.documentElement.dataset.gameReady = 'false';
      }
      return;
    }

    startDiagnosticLoop('landscape-detected');
    if (!game) startGame();
    else {
      game.scale.refresh();
      updateDiagnostics('scale-refreshed');
    }
  }, 350);
}

window.addEventListener('error', event => {
  showStartupError(event.error || event.message);
  updateDiagnostics(`window-error: ${event.message || 'unknown'}`);
});
window.addEventListener('unhandledrejection', event => {
  showStartupError(event.reason);
  updateDiagnostics(`promise-error: ${event.reason?.message || event.reason || 'unknown'}`);
});
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
