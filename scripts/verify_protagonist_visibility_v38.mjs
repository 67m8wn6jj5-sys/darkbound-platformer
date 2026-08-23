import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main=readFileSync('src/main.js','utf8');
const fix=readFileSync('src/v38ProtagonistVisibilityFix.js','utf8');

assert.match(main,/import '\.\/v38ProtagonistVisibilityFix\.js'/,'V38 visibility guard must load before the game starts');
assert.match(main,/scene: \[GameSceneV38\]/,'visibility fix must preserve V38 as the live scene');
assert.match(fix,/GameSceneV38\.prototype\.ensureProtagonistRenderV38/);
assert.match(fix,/if\(!validDisplayObject\(this\.pixelArt\)\)/,'destroyed protagonist art must be recreated');
assert.match(fix,/FALLBACK_IDLE_KEY='px-idle-east-000'/,'recreation must use an already-preloaded protagonist frame');
assert.match(fix,/this\.updatePixelArt\?\.\(time\)/,'fix must reuse established frame grounding and animation code');
assert.match(fix,/setDepth\(PROTAGONIST_DEPTH_V38\)/,'protagonist must be explicitly layered above Cathedral terrain');
assert.match(fix,/setScrollFactor\(1,1\)/,'protagonist must remain in world space');
assert.match(fix,/originalRebuild\.call\(this,template\)/,'Cathedral rebuild must be wrapped');
assert.match(fix,/originalUpdate\.call\(this,time,delta\)/,'runtime visibility must be guarded every frame');
assert.ok(!fix.includes('environmentLayout.player={'),'visibility guard must not mutate Cathedral topology');

console.log('V38 protagonist visibility regression verification passed.');
