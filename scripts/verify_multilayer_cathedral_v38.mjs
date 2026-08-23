import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests=[
  ['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {};\n'],
  ['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {};\n'],
  ['src/boss1Manifest.js','export const BOSS1_MANIFEST = {};\n'],
];
const created=[];
for(const [path,source] of temporaryManifests){if(!existsSync(path)){writeFileSync(path,source);created.push(path);}}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});

globalThis.Phaser={
  Scene:class Scene{},
  BlendModes:{ADD:'ADD'},
  Input:{Keyboard:{JustDown:()=>false}},
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value)),Linear:(a,b,t)=>a+(b-a)*t},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {GameSceneV38,CATHEDRAL_V38,CATHEDRAL_SPACES_V38,generateCathedralV38}=await import('../src/GameSceneV38.js');
const {GameSceneV37}=await import('../src/GameSceneV37.js');
const {TUNING}=await import('../src/config.js');

assert.ok(GameSceneV38.prototype instanceof GameSceneV37,'V38 must preserve V37 Souls/relics and the full combat stack');
assert.equal(CATHEDRAL_V38.spaceCount,18);
assert.ok(CATHEDRAL_V38.worldHeight>=2500,'Cathedral needs real multi-screen vertical world bounds');
assert.ok(CATHEDRAL_V38.totalVerticalRange>=2000,'Cathedral should span almost three 720p screens vertically');
assert.equal(CATHEDRAL_SPACES_V38.length,18);
assert.ok(CATHEDRAL_SPACES_V38.some(space=>space.connections.length>=3),'room graph needs an actual branch');
assert.ok(CATHEDRAL_SPACES_V38.find(space=>space.id==='high-gallery')?.connections.includes('secret-chapel'));
assert.ok(CATHEDRAL_SPACES_V38.find(space=>space.id==='central-shaft')?.bounds.h>=1500,'central shaft must be a major vertical descent');

const layout=generateCathedralV38(42,'duel');
assert.equal(layout.grammar,'cathedralGraphV38');
assert.equal(layout.sections.length,18);
assert.equal(layout.worldWidth,CATHEDRAL_V38.worldWidth);
assert.equal(layout.worldHeight,CATHEDRAL_V38.worldHeight);
assert.equal(layout.fallResetY,CATHEDRAL_V38.fallResetY);
assert.ok(layout.floorSegments.length>=18);
assert.ok(layout.platforms.length>=45,'multi-layer traversal needs substantial authored connective geometry');
assert.ok(layout.walls.length>=3);
assert.ok(layout.checkpoints.length>=10);
assert.ok(layout.groundSpawns.length>=14);
assert.ok(layout.perchSpawns.length>=7);
assert.equal(layout.collision.length,layout.floorSegments.length+layout.platforms.length+layout.walls.length);
const surfaceYs=[...layout.floorSegments,...layout.platforms].map(spec=>spec.y);
assert.ok(Math.max(...surfaceYs)-Math.min(...surfaceYs)>=2000,'playable surfaces must occupy multiple vertical screen heights');
assert.ok(layout.exitY<1000&&layout.player.y>2200,'run should begin low and finish high');

const highGallery=layout.floorSegments.filter(spec=>spec.section==='high-gallery').sort((a,b)=>a.x-b.x);
assert.equal(highGallery.length,2,'high gallery should contain a deliberate drop opening');
assert.ok(highGallery[1].x-(highGallery[0].x+highGallery[0].w)>=128,'high gallery opening must be a real collision gap');

const source=readFileSync('src/GameSceneV38.js','utf8');
for(const token of [
  'addCathedralDepthV38','applyCathedralBoundsV38','updateVerticalCameraV38','configureStageActivationV24','updateCheckpointV34',
  'v38AirDashUsed','v38DashHitIds','damageEnemyWithDashV38','DASH_DAMAGE=.5',"this.attackVisualAction='attack_3'",
])assert.ok(source.includes(token),`V38 runtime missing ${token}`);
assert.match(source,/dodgePressed&&!grounded&&canDash&&!this\.v38AirDashUsed/,'air dash must be available exactly when airborne and unused');
assert.match(source,/setVelocityY\?\.\(0\)/,'air dash should flatten vertical velocity into a committed horizontal dash');
assert.match(source,/this\.v38DashHitIds=new Set\(\)/,'each dash must reset its one-hit-per-enemy ledger');
assert.match(source,/enemy\.hp=Math\.max\(0,\(enemy\.hp\|\|0\)-DASH_DAMAGE\)/,'dash must deal minor contact damage');
assert.match(source,/const airborne=!this\.player\?\.body\?\.blocked\?\.down/,'airborne attack visuals must be selected from grounded state');
assert.match(source,/depth!==0/,'only the first normal area should be replaced while later V37 expedition stages remain available');

assert.deepEqual(TUNING.attackDurationsMs,[230,245,500]);
assert.deepEqual(TUNING.attackActiveStartMs,[52,60,80]);
assert.deepEqual(TUNING.attackActiveEndMs,[144,164,220]);
assert.deepEqual(TUNING.attackRanges,[80,88,104]);

const base=readFileSync('src/GameScene.js','utf8');
assert.match(base,/environmentLayout\?\.fallResetY\?\?TUNING\.respawnY/,'base fall recovery must respect a taller authored layout');
const main=readFileSync('src/main.js','utf8');
assert.match(main,/import \{ GameSceneV38 \} from '\.\/GameSceneV38\.js'/);
assert.match(main,/scene: \[GameSceneV38\]/);
assert.match(main,/GameSceneV38 -> GameSceneV37 -> GameSceneV36 -> GameSceneV35 -> GameSceneV34/);

console.log('V38 multi-layer Cathedral + aerial dash/combat verification passed.');
