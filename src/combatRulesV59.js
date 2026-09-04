// Pure geometry helpers for V59 sword collision. Keeping this module free of
// Phaser lets the collision math run in GitHub Actions without a browser.

export const COMBAT_V59=Object.freeze({
  bladeRadius:8,
  sweepSamples:6,
});

function finite(value){return Number.isFinite(Number(value));}
function point(value){return value&&finite(value.x)&&finite(value.y)?{x:Number(value.x),y:Number(value.y)}:null;}

function bounds(value,radius=0){
  if(!value)return null;
  const left=Number(value.left),right=Number(value.right),top=Number(value.top),bottom=Number(value.bottom);
  if(![left,right,top,bottom].every(Number.isFinite))return null;
  const pad=Math.max(0,Number(radius)||0);
  return{
    left:Math.min(left,right)-pad,
    right:Math.max(left,right)+pad,
    top:Math.min(top,bottom)-pad,
    bottom:Math.max(top,bottom)+pad,
  };
}

function inside(p,box){
  return p.x>=box.left&&p.x<=box.right&&p.y>=box.top&&p.y<=box.bottom;
}

// Liang-Barsky segment/rectangle intersection. The rectangle is expanded by
// bladeRadius before the test, turning the thin root->tip line into a forgiving
// sword-width capsule without reverting to the old character-centered box.
export function segmentIntersectsAabbV59(start,end,targetBounds,radius=0){
  const a=point(start),b=point(end),box=bounds(targetBounds,radius);
  if(!a||!b||!box)return false;
  if(inside(a,box)||inside(b,box))return true;

  const dx=b.x-a.x,dy=b.y-a.y;
  const p=[-dx,dx,-dy,dy];
  const q=[a.x-box.left,box.right-a.x,a.y-box.top,box.bottom-a.y];
  let t0=0,t1=1;

  for(let i=0;i<4;i++){
    if(Math.abs(p[i])<1e-9){
      if(q[i]<0)return false;
      continue;
    }
    const r=q[i]/p[i];
    if(p[i]<0){
      if(r>t1)return false;
      if(r>t0)t0=r;
    }else{
      if(r<t0)return false;
      if(r<t1)t1=r;
    }
  }
  return t0<=t1;
}

function lerpPoint(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
function validSegment(value){
  const root=point(value?.root),tip=point(value?.tip);
  return root&&tip?{root,tip}:null;
}

// Test the blade at several interpolated poses between the previously processed
// animation frame and the current one. This catches enemies crossed by a fast
// sword between rendered frames and makes collision much less frame-rate
// dependent than testing only the current line segment.
export function bladeSweepIntersectsAabbV59(previousSegment,currentSegment,targetBounds,radius=COMBAT_V59.bladeRadius,samples=COMBAT_V59.sweepSamples){
  const current=validSegment(currentSegment);
  if(!current)return false;
  if(segmentIntersectsAabbV59(current.root,current.tip,targetBounds,radius))return true;

  const previous=validSegment(previousSegment);
  if(!previous)return false;
  if(segmentIntersectsAabbV59(previous.root,previous.tip,targetBounds,radius))return true;

  const count=Math.max(1,Math.floor(Number(samples)||1));
  for(let i=1;i<count;i++){
    const t=i/count;
    const root=lerpPoint(previous.root,current.root,t);
    const tip=lerpPoint(previous.tip,current.tip,t);
    if(segmentIntersectsAabbV59(root,tip,targetBounds,radius))return true;
  }
  return false;
}
