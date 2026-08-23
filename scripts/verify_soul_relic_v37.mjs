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
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {GameSceneV37,SOUL_RELIC_V37,RELICS_V37,relicChoicesV37}=await import('../src/GameSceneV37.js');
const {GameSceneV36}=await import('../src/GameSceneV36.js');
const {EXPEDITION_V34}=await import('../src/GameSceneV34.js');

assert.ok(GameSceneV37.prototype instanceof GameSceneV36,'V37 must preserve the complete V36 presentation/combat stack');
assert.equal(Object.keys(RELICS_V37).length,8,'V37 should launch with eight meaningful relics');
assert.deepEqual(SOUL_RELIC_V37.altarSections,[2,5]);
assert.deepEqual(SOUL_RELIC_V37.chestSections,[1,6]);
assert.ok(SOUL_RELIC_V37.magnetRadius>=200);
assert.ok(SOUL_RELIC_V37.eliteSoulValue>=8);
assert.equal(EXPEDITION_V34.normalStageCount,4);

const first=relicChoicesV37(1234,0,[]);
const repeat=relicChoicesV37(1234,0,[]);
assert.deepEqual(first,repeat,'relic offerings must be deterministic for a room seed');
assert.equal(first.length,2);
assert.notEqual(first[0].id,first[1].id);
const owned=[first[0].id];
const filtered=relicChoicesV37(1234,0,owned);
assert.ok(filtered.every(relic=>!owned.includes(relic.id)),'owned relics must not be offered again');

const source=readFileSync('src/GameSceneV37.js','utf8');
for(const token of [
  'spawnSoulDropV37','updateSoulDropsV37','collectSoulV37','magnetRadius',
  'addAltarV37','openRelicChoiceV37','chooseRelicV37','addChestV37','openChestV37',
  'markEliteV37','v37Elite','eliteSoulValue','createSoulHudV37',
])assert.ok(source.includes(token),`V37 gameplay loop missing ${token}`);

for(const relic of Object.keys(RELICS_V37))assert.ok(source.includes(`'${relic}'`)||source.includes(`${relic}:`),`runtime effect missing for ${relic}`);
assert.match(source,/run\.souls-=altar\.cost/,'relic altars must spend the collected soul currency');
assert.match(source,/run\.relics\.add\(relic\.id\)/,'chosen relics must persist in the run build');
assert.match(source,/run\.claimedAltars\.add\(altar\.key\)/,'altars must not be farmable repeatedly');
assert.match(source,/openedChests\.add\(chest\.key\)/,'optional chests must not be farmable repeatedly');
assert.match(source,/step===2\)this\.emitGreenFlameV37/,'Green Flame must visibly modify the combo finisher');
assert.match(source,/lastRollAt=time-180/,'Phantom Step must change dodge recovery');
assert.match(source,/run\.kills%5===0/,'Soul Leech must have a deterministic healing trigger');
assert.match(source,/player\?\.body\?\.blocked\?\.down/,'Air Cutter must depend on airborne state');
assert.match(source,/v37RapidHits>=3/,'Relentless must reward rapid hit chains');

assert.match(source,/openReward\(roomIndex\)/,'V37 must intercept the old prototype room-clear reward flow');
assert.match(source,/transitionToNextNode/,'room clear must flow directly to the next stage when no route choice is due');
assert.match(source,/openRouteChoice/,'branch depths must still present the route decision');
assert.doesNotMatch(source,/super\.openReward\(/,'V37 must not revive the old three-card stat reward screen');

const main=readFileSync('src/main.js','utf8');
assert.match(main,/import \{ GameSceneV37 \} from '\.\/GameSceneV37\.js'/);
assert.match(main,/scene: \[GameSceneV37\]/);
assert.match(main,/GameSceneV37 -> GameSceneV36 -> GameSceneV35 -> GameSceneV34/);

console.log('V37 Soul & Relic gameplay-loop verification passed.');
