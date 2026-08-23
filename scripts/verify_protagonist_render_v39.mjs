import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('src/GameSceneV39.js','utf8');
const main=readFileSync('src/main.js','utf8');

assert.match(source,/extends GameSceneV38/);
assert.match(source,/CACHE_BUST='protagonist-v39-rescue-20260823-2'/);
assert.match(source,/for\(const \[action,meta\] of Object\.entries\(PIXELLAB_MANIFEST\)\)/);
assert.match(source,/rescueFrameKey/);
assert.match(source,/rescueRotationKey/);
assert.match(source,/this\.textures\?\.exists\?\.\(rescue\)/);
assert.match(source,/art\.setVisible\(true\)\.setActive\(true\)\.setDepth\(300\)\.setScrollFactor\(1,1\)/);
assert.match(source,/this\.player\.setVisible\?\.\(true\)\.setActive\?\.\(true\)\.setDepth\?\.\(90\)/);
assert.match(source,/updatePixelArt\(time\)[\s\S]*super\.updatePixelArt\(time\)[\s\S]*repairProtagonistRenderV39/);
assert.match(source,/update\(time,delta\)[\s\S]*super\.update\(time,delta\)[\s\S]*repairProtagonistRenderV39/);
assert.match(main,/import \{ GameSceneV39 \} from '\.\/GameSceneV39\.js'/);
assert.match(main,/import '\.\/v38ProtagonistVisibilityFix\.js'/);
assert.match(main,/scene: \[GameSceneV39\]/);
assert.match(main,/GameSceneV39 -> GameSceneV38 -> GameSceneV37/);

console.log('V39 cache-busted protagonist render rescue verification passed.');
