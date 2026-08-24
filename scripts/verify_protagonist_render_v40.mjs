import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync('src/GameSceneV40.js','utf8');
const main=readFileSync('src/main.js','utf8');
const index=readFileSync('index.html','utf8');

assert.match(source,/PROTAGONIST_DEPTH_V40=600/);
assert.match(source,/V40_ENTRY_CACHE_BUST='v40-protagonist-rescue-20260824-1'/);
assert.match(source,/createDedicatedProtagonistV40/);
assert.match(source,/syncDedicatedProtagonistV40/);
assert.match(source,/RESCUE_PREFIX/);
assert.match(source,/this\.v40ProtagonistArt=this\.add\.image/);
assert.match(source,/setScrollFactor\(1,1\)/);
assert.match(source,/setDepth\(PROTAGONIST_DEPTH_V40\)/);
assert.match(source,/setPosition\(x,y\)/);
assert.match(source,/originalCreate\.call\(this\)/);
assert.match(source,/originalRebuild\.call\(this,template\)/);
assert.match(source,/originalUpdate\.call\(this,time,delta\)/);

assert.match(main,/import '\.\/GameSceneV40\.js'/);
assert.match(main,/scene: \[GameSceneV38\]/);
assert.match(main,/independent protagonist renderer/);
assert.match(index,/src\/main\.js\?v=v40-protagonist-rescue-20260824-1/);
assert.doesNotMatch(index,/src\/main\.js\?v=v28-worldgen/);

console.log('V40 independent protagonist renderer and entry-cache-bust verification passed.');
