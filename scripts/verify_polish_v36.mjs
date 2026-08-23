import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('src/GameSceneV36.js','utf8');
const v37=readFileSync('src/GameSceneV37.js','utf8');
const main=readFileSync('src/main.js','utf8');

assert.match(source,/extends GameSceneV35/,'V36 must preserve V35 cleanup and the full inherited game stack');
assert.match(v37,/extends GameSceneV36/,'V37 must preserve the complete V36 polish layer');
assert.match(main,/import \{ GameSceneV37 \} from '\.\/GameSceneV37\.js'/);
assert.match(main,/scene: \[GameSceneV37\]/);
assert.match(main,/GameSceneV37 -> GameSceneV36 -> GameSceneV35 -> GameSceneV34/);

assert.match(source,/lookAheadPx:128/);assert.match(source,/velocity\*\.34/);assert.match(source,/v36CameraLook\+=\(target-this\.v36CameraLook\)\*\.055/);assert.match(source,/camera\.setDeadzone\(POLISH_V36\.cameraDeadzoneW,POLISH_V36\.cameraDeadzoneH\)/);
assert.match(source,/super\.rebuildRoomLayout\(template\)/);assert.doesNotMatch(source,/addEnvironmentCollider\(|addTraversalCollider\(|generateExpeditionStageV34\(/,'V36 must not fork or mutate traversal collision geometry');
assert.match(source,/addTerrainDepthV36/);assert.match(source,/floorShadowAlpha:\.34/);assert.match(source,/platformShadowAlpha:\.26/);assert.match(source,/0xb8bdc5/);
assert.match(source,/addSectionSilhouetteV36/);assert.match(source,/ENVIRONMENT_ART_V30\.architecture\.key/);assert.match(source,/ENVIRONMENT_ART_V30\.background\.key/);assert.match(source,/layout\.sections\.forEach/);assert.match(source,/setScrollFactor\(\.84,1\)/);assert.match(source,/setScrollFactor\(\.90,1\)/);
assert.match(source,/addAtmosphereV36/);assert.match(source,/addTraversalLightV33/);assert.match(source,/const halo=this\.add\.circle/);assert.match(source,/const pool=this\.add\.ellipse/);assert.match(source,/const core=this\.add\.circle/);assert.match(source,/suppressPrototypeGeometryV35\(\)/);assert.doesNotMatch(source,/dangerLane|damageOverlay|attackFlash|attackArc/);
assert.match(source,/const ground=floorAtV36\(layout\.floorSegments,slot\.x\)/);assert.match(source,/const y=ground\?\.y\?\?slot\.y/);
console.log('V36 presentation and traversal polish verification passed beneath V37.');
