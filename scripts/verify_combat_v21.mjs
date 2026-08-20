import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const temporaryManifests=[
  ['src/enemy1Manifest.js','export const ENEMY1_MANIFEST = {patrol:{east:1,west:1},lunge:{east:8,west:8},hit:{east:8,west:8},death:{east:8,west:8}};\n'],
  ['src/enemy2Manifest.js','export const ENEMY2_MANIFEST = {patrol:{east:1,west:1},attack:{east:9,west:9},hit:{east:8,west:8},death:{east:8,west:8},rock:"rock/rock.png"};\n'],
  ['src/boss1Manifest.js','export const BOSS1_MANIFEST = {idle:{east:1,west:1},lunge:{east:9,west:9},slam:{east:9,west:9},hit:{east:8,west:8},death:{east:8,west:8}};\n'],
];
const created=[];
for(const [path,source] of temporaryManifests){if(!existsSync(path)){writeFileSync(path,source);created.push(path);}}
process.on('exit',()=>{for(const path of created){try{unlinkSync(path);}catch{}}});

globalThis.Phaser={
  Scene:class Scene{},
  BlendModes:{ADD:'ADD'},
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {GameSceneV21,COMBAT_V21,swordPriorityContactIsValid}=await import('../src/GameSceneV21.js');

const mainSource=readFileSync('src/main.js','utf8');
const v22Source=readFileSync('src/GameSceneV22.js','utf8');
assert.match(mainSource,/GameSceneV22/,'main must boot the current environment/combat scene');
assert.match(v22Source,/extends GameSceneV21/,'V22 must preserve the sword-charge priority rules through inheritance');
assert.ok(COMBAT_V21.swordPriority.rangeGracePx<=12,'sword priority must stay close to the real sword reach');
assert.ok(COMBAT_V21.swordPriority.rearGracePx<=10,'sword priority must not protect attacks aimed the wrong way');

assert.equal(swordPriorityContactIsValid(60,20,80,0),true,'attack 1 active sword contact should beat a charge');
assert.equal(swordPriorityContactIsValid(60,20,30,0),false,'attack 1 anticipation must not beat a charge');
assert.equal(swordPriorityContactIsValid(60,20,145,0),false,'attack 1 recovery must not beat a charge');
assert.equal(swordPriorityContactIsValid(88,20,100,1),true,'attack 2 active contact should beat a charge at its real reach');
assert.equal(swordPriorityContactIsValid(100,20,120,2),true,'heavy active contact should beat a charge');
assert.equal(swordPriorityContactIsValid(-20,20,80,0),false,'enemy clearly behind the sword must still punish the player');
assert.equal(swordPriorityContactIsValid(120,20,80,0),false,'enemy outside sword reach must still punish the player');
assert.equal(swordPriorityContactIsValid(60,90,80,0),false,'large vertical separation must not create a clash');

const scene=Object.create(GameSceneV21.prototype);
scene.state='attack-1';scene.attackStartsAt=1000;scene.comboStep=0;scene.facing=1;scene.player={x:100,y:100};
const enemy={alive:true,type:'enemy1',sprite:{x:160,y:105}};
assert.equal(scene.playerSwordHasPriorityAgainst(enemy,1080),true,'live active attack should claim priority');
scene.state='idle';
assert.equal(scene.playerSwordHasPriorityAgainst(enemy,1080),false,'idle player must never gain sword priority');

const source=readFileSync('src/GameSceneV21.js','utf8');
assert.match(source,/enemy\?\.type==='enemy1'&&enemy\.state==='lunge'/,'priority must apply specifically to committed melee charges');
assert.match(source,/this\.playerSwordHasPriorityAgainst\(enemy,time\)/,'incoming charge damage must check active sword contact first');
assert.match(source,/this\.interruptChargeWithSword\(enemy,time\);\s*return;/s,'successful clash must return before player damage');
assert.match(source,/this\.attackHitIds\?\.add\(enemy\.id\)/,'clash must consume the sword hit exactly once');
assert.match(source,/this\.damageEnemy\(enemy,step\)/,'clash must damage and stagger the charging enemy');
assert.match(source,/spawnSwordChargeClash/,'charge interruption must have dedicated impact feedback');

console.log('Sword priority over melee charge verification passed.');
