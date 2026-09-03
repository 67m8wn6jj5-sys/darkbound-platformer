export const COMBAT_V58=Object.freeze({
  bossSlamRadius:260,
  bossSlamVerticalTolerance:82,
  bossLungeActiveStartMs:92,
  bossLungeActiveEndMs:238,
  bossLungeForwardForgiveness:16,
  bossLungeRange:104,
  bossLungeVerticalTolerance:88,
  dashDamage:.5,
});

function positionOf(entity){
  const x=Number(entity?.x??entity?.sprite?.x);
  const y=Number(entity?.y??entity?.sprite?.y);
  return{
    x:Number.isFinite(x)?x:0,
    y:Number.isFinite(y)?y:0,
  };
}

export function cancelPlayerAttackV58(scene){
  if(!scene)return false;
  const now=Number(scene?.time?.now)||0;
  const wasAttacking=String(scene?.state||'').startsWith('attack-')||
    (Number.isFinite(scene?.attackEndsAt)&&scene.attackEndsAt>now);

  scene.attackStartsAt=-Infinity;
  scene.attackEndsAt=-Infinity;
  scene.comboExpiresAt=-Infinity;
  scene.attackQueued=false;
  scene.comboStep=0;
  scene.attackHitIds?.clear?.();
  scene.attackFlash?.setVisible?.(false);
  scene.attackArc?.setVisible?.(false);
  scene.tweens?.killTweensOf?.(scene.player?.weapon);
  scene.player?.weapon?.setAngle?.(0);
  scene.lastAttackFxToken='';
  scene.attackVisualAction=null;
  scene.lastVisualAttackAction=null;
  if(String(scene?.state||'').startsWith('attack-'))scene.state='idle';
  return wasAttacking;
}

export function bossSlamCanHitV58(player,enemy){
  if(!player||!enemy||!player?.body?.blocked?.down)return false;
  const p=positionOf(player),e=positionOf(enemy);
  return Math.abs(p.x-e.x)<=COMBAT_V58.bossSlamRadius&&
    Math.abs(p.y-e.y)<=COMBAT_V58.bossSlamVerticalTolerance;
}

export function bossLungeCanHitV58(player,enemy,elapsedMs){
  if(!player||!enemy)return false;
  const elapsed=Number(elapsedMs);
  if(!Number.isFinite(elapsed)||elapsed<COMBAT_V58.bossLungeActiveStartMs||elapsed>COMBAT_V58.bossLungeActiveEndMs)return false;

  const p=positionOf(player),e=positionOf(enemy);
  const facing=(Number(enemy?.attackFacing)||Number(enemy?.facing)||1)<0?-1:1;
  const forward=(p.x-e.x)*facing;
  const dy=Math.abs(p.y-e.y);
  return forward>=-COMBAT_V58.bossLungeForwardForgiveness&&
    forward<=COMBAT_V58.bossLungeRange&&
    dy<=COMBAT_V58.bossLungeVerticalTolerance;
}
