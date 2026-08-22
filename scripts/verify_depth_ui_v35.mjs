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
assert.match(source,/setAlpha\(\.38\)/,'rear masonry must be plainly visible, not the old 13% wash');
assert.match(source,/setAlpha\(\.21\)/,'middle architecture texture must remain visible');
assert.match(source,/setAlpha\(\.14\)/,'near texture layer must create a third depth plane');
assert.match(source,/addDepthBaysV35/,'large architectural recesses must break up flat wallpaper repetition');
assert.match(source,/setScrollFactor\(\.48,1\)/,'deep recesses must move at a distinct parallax rate');
assert.match(source,/setScrollFactor\(\.70,1\)/,'architectural columns must sit on a separate parallax plane');

assert.match(source,/showRoomBanner\(\)\{\}/,'prototype room banners must stay disabled');
for(const key of ['environmentDebugText','roomProgressText','runGraphText','runRouteText']){
  assert.ok(source.includes(`'${key}'`),`${key} must be hidden from normal play`);
}
assert.match(source,/bossHud\?\.label/,'boss-name text must also be removed from the playfield');

assert.match(source,/addExitGateV34/,'V35 must replace the V34 glowing exit rectangle');
assert.match(source,/lineBetween/,'exit landmark should be physical-looking ironwork');
assert.doesNotMatch(source,/add\.rectangle\(layout\.exitX[\s\S]{0,180}BlendModes\.ADD/,'exit must not use the old additive glowing rectangle');
assert.match(source,/suppressTellV35/,'enemy geometric warning shapes must be suppressed');
assert.match(source,/enemy\.tell\.setVisible\(false\)\.setAlpha\(0\)/,'enemy tells must never remain visible');
assert.match(source,/pulseEnemyArtV35/,'attack readability must move onto the enemy sprite itself');
assert.match(source,/beginMeleeWindup/);
assert.match(source,/beginTrollAim/);
assert.match(source,/beginBossLunge/);
assert.match(source,/beginBossSlam/);

const main=readFileSync('src/main.js','utf8');
assert.match(main,/import \{ GameSceneV35 \} from '\.\/GameSceneV35\.js'/);
assert.match(main,/scene: \[GameSceneV35\]/);
assert.match(main,/GameSceneV35 -> GameSceneV34 -> GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29/);

console.log('V35 visible textured depth, clean playfield UI, and diegetic telegraph verification passed.');
