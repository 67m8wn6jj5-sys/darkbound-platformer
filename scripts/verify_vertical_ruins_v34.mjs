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
  Math:{Between:(a)=>a,Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))},
  Utils:{Array:{GetRandom:(values)=>values[0],Shuffle:(values)=>values}},
};

const {
  EXPEDITION_V34,
  generateExpeditionStageV34,
  expandedRosterV34,
  GameSceneV34,
}=await import('../src/GameSceneV34.js');

assert.ok(EXPEDITION_V34.right-EXPEDITION_V34.left>=12000,'normal stages must remain substantially longer than V33');
assert.equal(EXPEDITION_V34.sectionsPerStage,8);
assert.equal(EXPEDITION_V34.normalStageCount,4);
assert.ok(EXPEDITION_V34.activationDistancePx>=800&&EXPEDITION_V34.activationDistancePx<=1000);

const stageLabels=[];
for(let depth=0;depth<4;depth++){
  const room=generateExpeditionStageV34(42,depth,['duel','hunters','mixed','pressure'][depth]);
  stageLabels.push(room.label);
  assert.equal(room.grammar,'verticalRuinsExpedition');
  assert.equal(room.sections.length,8,`depth ${depth} must have eight authored traversal districts`);
  assert.equal(room.checkpoints.length,8,`depth ${depth} must checkpoint each district`);
  assert.equal(room.lights.length,8,`depth ${depth} needs one restrained authored light landmark per district`);
  assert.equal(room.objects.length,3,`depth ${depth} should use exactly three small object accents`);
  assert.ok(room.worldWidth>=13000);
  assert.ok(room.groundSpawns.length>=18,`depth ${depth} needs spawn coverage across the whole stage`);
  assert.ok(room.perchSpawns.length>=10,`depth ${depth} needs enough elevated ranged positions`);
  assert.ok(room.platforms.length>=20,`depth ${depth} needs substantially richer platforming than V33`);
  assert.ok(room.platforms.filter(spec=>spec.role==='upper').length>=5,`depth ${depth} needs optional upper lanes`);

  for(let index=0;index<room.sections.length;index++){
    const section=room.sections[index];
    assert.equal(section.start,EXPEDITION_V34.left+index*EXPEDITION_V34.sectionWidth);
    assert.equal(section.end,section.start+EXPEDITION_V34.sectionWidth);
    if(index>0)assert.equal(section.start,room.sections[index-1].end,'districts must connect without dead horizontal space');
  }

  const floorYs=[...new Set(room.floorSegments.map(spec=>spec.y))];
  assert.ok(floorYs.length>=3,`depth ${depth} must vary actual ground elevation`);

  let realGapCount=0;
  for(const section of room.sections){
    const floors=room.floorSegments.filter(spec=>spec.section===section.id).sort((a,b)=>a.x-b.x);
    for(let index=1;index<floors.length;index++){
      const gap=floors[index].x-(floors[index-1].x+floors[index-1].w);
      if(gap>0){
        realGapCount++;
        assert.ok(gap<=128,`real chasm ${gap}px is wider than the intended baseline jump`);
      }
    }
  }
  assert.ok(realGapCount>=2,`depth ${depth} should contain real traversal chasms rather than fake visual gaps`);
  assert.equal(room.collision.length,room.floorSegments.length+room.platforms.length,'renderable traversal geometry and collision inventory must match exactly');
  assert.ok(room.exitX>EXPEDITION_V34.right-400);
}
assert.equal(new Set(stageLabels).size,4,'the four normal run areas must have distinct identities');

assert.deepEqual([0,1,2,3].map(depth=>expandedRosterV34('mixed',depth).length),[10,12,14,16]);
assert.equal(expandedRosterV34('elite',3,true).length,16);
assert.ok(GameSceneV34.prototype.isBranchDepth(0),'opening branch must be restored after the old V16 boss-test shortcut');
assert.ok(GameSceneV34.prototype.isBranchDepth(2));
assert.equal(GameSceneV34.prototype.isBranchDepth(1),false);

const source=readFileSync('src/GameSceneV34.js','utf8');
assert.match(source,/extends GameSceneV33/);
assert.match(source,/ENVIRONMENT_ART_V30\.background\.key/,'V34 must restore the recessed masonry as a low-alpha moving depth layer');
assert.match(source,/ENVIRONMENT_ART_V30\.architecture\.key/,'V34 must use the architecture tileset for complete structural frames and parallax detail');
assert.match(source,/tilePositionX=scroll\*\.22/,'rear masonry must parallax independently');
assert.match(source,/tilePositionX=scroll\*\.38/,'near architecture must parallax faster than the rear wall');
assert.match(source,/setScrollFactor\(0\)/,'parallax layers should be screen-anchored and moved by camera scroll');
assert.doesNotMatch(source,/ENVIRONMENT_ART_V30\.arches/,'rejected tiny arch-object exports must not be used in V34');
assert.match(source,/renderGothicTerrain\(\[\.\.\.layout\.floorSegments,\.\.\.layout\.platforms\]\)/,'visible terrain must be rendered from the exact collision floor/platform set');
assert.match(source,/fallResetY/,'real pits must have checkpoint recovery before the legacy fallback respawn');
assert.match(source,/updateCheckpointV34/);
assert.match(source,/AREA CLEARED • REACH THE GREEN GATE/,'clearing enemies must require traversal to the authored exit instead of ending mid-stage');
assert.match(source,/depth===0\|\|depth===2/,'the normal five-node route structure must be restored');
assert.match(source,/\[10,12,14,16\]/,'enemy density must scale through the expedition');

const main=readFileSync('src/main.js','utf8');
assert.match(main,/import \{ GameSceneV34 \} from '\.\/GameSceneV34\.js'/);
assert.match(main,/scene: \[GameSceneV34\]/);
assert.match(main,/GameSceneV34 -> GameSceneV33 -> GameSceneV32 -> GameSceneV31 -> GameSceneV30 -> GameSceneV29/);

console.log('V34 vertical ruins expedition verification passed.');
