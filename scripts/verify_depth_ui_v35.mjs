import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests=[
  ['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {};\n'],
  ['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {};\n'],
  ['src/boss1Manifest.js','export const BOSS1_MANIFEST = {};\n'],
];
const created=[];
for(const [path,source] of temporaryManifests){
  if(!existsSync(path)){writeFileSync(path,source);created.push(path);}
}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});

globalThis.Phaser={
  Scene:class Scene{},
  BlendModes:{ADD:'ADD'},
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {GameSceneV35}=await import('../src/GameSceneV35.js');
const {GameSceneV34,EXPEDITION_V34,generateExpeditionStageV34}=await import('../src/GameSceneV34.js');

assert.ok(GameSceneV35.prototype instanceof GameSceneV34,'V35 must preserve the complete V34 expedition/combat stack');
assert.equal(EXPEDITION_V34.normalStageCount,4);
assert.ok(generateExpeditionStageV34(42,0,'duel').sections.length>=8);

const source=readFileSync('src/GameSceneV35.js','utf8');
assert.match(source,/ENVIRONMENT_ART_V30\.background\.key/,'V35 must render the uploaded recessed masonry background tileset');
assert.match(source,/ENVIRONMENT_ART_V30\.architecture\.key/,'V35 must render the uploaded architecture tileset');
assert.match(source,/setAlpha\(\.82\)/,'rear masonry must be strongly visible on phone');
assert.match(source,/setAlpha\(\.56\)/,'middle architecture texture must be clearly visible');
assert.match(source,/setAlpha\(\.30\)/,'near texture layer must create an obvious third depth plane');
assert.doesNotMatch(source,/setAlpha\(\.82\)\.setTint|setAlpha\(\.56\)\.setTint|setAlpha\(\.30\)\.setTint/,'background texture planes must not be darkened by tint multiplication');
assert.match(source,/addDepthBaysV35/,'large architectural recesses must break up flat wallpaper repetition');
assert.match(source,/setScrollFactor\(\.48,1\)/,'deep recesses must move at a distinct parallax rate');
assert.match(source,/setScrollFactor\(\.70,1\)/,'architectural columns must sit on a separate parallax plane');

assert.match(source,/showRoomBanner\(\)\{\}/,'prototype room banners must stay disabled');
for(const key of ['hud','debug','environmentDebugText','roomProgressText','runGraphText','runRouteText']){
  assert.ok(source.includes(`'${key}'`),`${key} must be hidden from normal play`);
}
assert.match(source,/updateHud\(\)[\s\S]*hud\?\.setVisible\?\.\(false\)/,'base enemy-count HUD must be forcibly hidden even when inherited code updates it');
assert.match(source,/debug\?\.setVisible\?\.\(false\)/,'base debug text must remain hidden');
assert.match(source,/bossHud\?\.label/,'boss-name text must also be removed from the playfield');

assert.match(source,/addExitGateV34/,'V35 must replace the V34 glowing exit rectangle');
assert.match(source,/lineBetween/,'exit landmark should be physical-looking ironwork');
assert.doesNotMatch(source,/add\.rectangle\(layout\.exitX[\s\S]{0,180}BlendModes\.ADD/,'exit must not use the old additive glowing rectangle');

assert.match(source,/createMeleeDangerLane\(enemy\)/,'V20 red danger-lane rectangles must be intercepted at creation');
assert.match(source,/clearMeleeDangerLane\?\.\(enemy\)/,'red danger lanes must be cleared before render');
assert.match(source,/suppressPrototypeGeometryV35/,'all inherited prototype geometry must be suppressed every frame');
assert.match(source,/attackFlash\?\.setVisible\?\.\(false\)/,'legacy player hitbox geometry must remain hidden');
assert.match(source,/attackArc\?\.setVisible\?\.\(false\)/,'legacy player arc geometry must remain hidden');
assert.match(source,/damageOverlay\?\.setVisible\?\.\(false\)/,'legacy red screen overlay must remain hidden');
assert.match(source,/enemy\.tell\.setVisible\(false\)\.setAlpha\(0\)/,'enemy tell circles must never remain visible');
assert.match(source,/showPlayerDamageFeedback\(\)/,'damage feedback must no longer emit floating text or red rings');
assert.doesNotMatch(source,/`-\$\{hpLost\} HP`|VFX_RED_HOT|dangerLaneAlpha/,'V35 itself must not recreate inherited red/text feedback');
assert.match(source,/pulseEnemyArtV35/,'attack readability must move onto the enemy sprite itself');
assert.match(source,/beginMeleeWindup/);
assert.match(source,/beginTrollAim/);
assert.match(source,/beginBossLunge/);
assert.match(source,/beginBossSlam/);

const main=readFileSync('src/main.js','utf8');
assert.match(main,/import \{ GameSceneV35 \} from '\.\/GameSceneV35\.js'/);
assert.match(main,/scene: \[GameSceneV35\]/);
assert.match(main,/GameSceneV35 -> GameSceneV34 -> GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29/);

console.log('V35 strong textured depth, hidden prototype HUD, and geometry-free telegraph verification passed.');
