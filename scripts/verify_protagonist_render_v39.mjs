import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('src/GameSceneV39.js','utf8');
const main=readFileSync('src/main.js','utf8');

assert.match(source,/GameSceneV38\.prototype\.preload/);
assert.match(source,/GameSceneV38\.prototype\.updatePixelArt/);
assert.match(source,/GameSceneV38\.prototype\.update/);
assert.match(source,/CACHE_BUST='protagonist-v39-rescue-20260823-2'/);
assert.match(source,/for\(const \[action,meta\] of Object\.entries\(PIXELLAB_MANIFEST\)\)/);
assert.match(source,/rescueFrameKey/);
assert.match(source,/rescueRotationKey/);
assert.match(source,/this\.textures\?\.exists\?\.\(rescue\)/);
assert.match(source,/setDepth\(PROTAGONIST_DEPTH_V39\)/);
assert.match(source,/setScrollFactor\(1,1\)/);
assert.match(source,/originalPreload\.call\(this\)/);
assert.match(source,/originalUpdatePixelArt\.call\(this,time\)/);
assert.match(source,/originalUpdate\.call\(this,time,delta\)/);

assert.match(main,/import \{ GameSceneV38 \} from '\.\/GameSceneV38\.js'/);
assert.match(main,/import '\.\/v38ProtagonistVisibilityFix\.js'/);
assert.match(main,/import '\.\/GameSceneV39\.js'/);
assert.match(main,/scene: \[GameSceneV38\]/);
assert.match(main,/Live chain: GameSceneV38 -> GameSceneV37/);

console.log('V39 cache-busted protagonist texture patch verification passed.');
