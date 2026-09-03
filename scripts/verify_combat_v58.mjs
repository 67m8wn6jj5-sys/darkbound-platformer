import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COMBAT_V58,
  cancelPlayerAttackV58,
  bossSlamCanHitV58,
  bossLungeCanHitV58,
} from '../src/combatRulesV58.js';

function player(x,y,grounded=true){return{x,y,body:{blocked:{down:grounded}}};}
function boss(x,y,facing=1){return{sprite:{x,y},facing,attackFacing:facing};}

// Player attack exclusivity.
const scene={
  time:{now:100},state:'attack-2',attackStartsAt:60,attackEndsAt:220,
  comboExpiresAt:500,attackQueued:true,comboStep:1,attackHitIds:new Set(['enemy']),
  attackFlash:{visible:true,setVisible(v){this.visible=v;return this;}},
  attackArc:{visible:true,setVisible(v){this.visible=v;return this;}},
  player:{weapon:{angle:35,setAngle(v){this.angle=v;return this;}}},
  tweens:{killTweensOf(){}},lastAttackFxToken:'old',attackVisualAction:'attack_2',lastVisualAttackAction:'attack_2',
};
assert.equal(cancelPlayerAttackV58(scene),true);
assert.equal(scene.attackEndsAt,-Infinity);
assert.equal(scene.attackQueued,false);
assert.equal(scene.comboStep,0);
assert.equal(scene.attackHitIds.size,0);
assert.equal(scene.attackFlash.visible,false);
assert.equal(scene.attackArc.visible,false);
assert.equal(scene.player.weapon.angle,0);
assert.equal(scene.state,'idle');

// Slam requires same-surface proximity and grounded player.
const slamBoss=boss(500,600,-1);
assert.equal(bossSlamCanHitV58(player(500,600,true),slamBoss),true);
assert.equal(bossSlamCanHitV58(player(500,600,false),slamBoss),false);
assert.equal(bossSlamCanHitV58(player(500+COMBAT_V58.bossSlamRadius+1,600,true),slamBoss),false);
assert.equal(bossSlamCanHitV58(player(520,600+COMBAT_V58.bossSlamVerticalTolerance+1,true),slamBoss),false);

// Lunge is committed, front-only, and only live during the middle strike window.
const lungeBoss=boss(500,600,1);
lungeBoss.attackFacing=1;
const target=player(570,602,true);
assert.equal(bossLungeCanHitV58(target,lungeBoss,COMBAT_V58.bossLungeActiveStartMs-1),false);
assert.equal(bossLungeCanHitV58(target,lungeBoss,COMBAT_V58.bossLungeActiveStartMs),true);
assert.equal(bossLungeCanHitV58(target,lungeBoss,COMBAT_V58.bossLungeActiveEndMs),true);
assert.equal(bossLungeCanHitV58(target,lungeBoss,COMBAT_V58.bossLungeActiveEndMs+1),false);
assert.equal(bossLungeCanHitV58(player(430,600,true),lungeBoss,150),false);

// Changing current facing must not change committed attackFacing geometry.
lungeBoss.facing=-1;
assert.equal(bossLungeCanHitV58(target,lungeBoss,150),true);

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const patch=fs.readFileSync(new URL('../src/GameSceneV58.js',import.meta.url),'utf8');
assert.match(main,/GameSceneV58\.js\?v=v58-combat-correctness-20260903-1/);
assert.match(main,/dataset\.build='v58'/);
assert.match(patch,/cancelPlayerAttackV58\(this\)/);
assert.match(patch,/bossSlamCanHitV58\(this\.player,enemy\)/);
assert.match(patch,/bossLungeCanHitV58\(this\.player,enemy,elapsed\)/);
assert.match(patch,/enemy\.type!==['"]boss1['"]/);
assert.doesNotMatch(patch,/enemy\.state=['"]stagger['"]/);

console.log('V58 combat correctness verification passed.');
console.log(`Boss slam radius: ${COMBAT_V58.bossSlamRadius}px; lunge active: ${COMBAT_V58.bossLungeActiveStartMs}-${COMBAT_V58.bossLungeActiveEndMs}ms.`);
