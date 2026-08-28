from pathlib import Path
from statistics import median
from collections import deque
from PIL import Image, ImageFilter
import math

ROOT=Path('assets/v05/pixellab_protagonist')
ACTIONS=['idle','run','jump','fall','land','dash','attack_1','attack_2','attack_3','hit','death']
DIRS=['east','west']


def components(mask):
    w,h=mask.size
    pix=mask.load()
    seen=set()
    out=[]
    for y in range(h):
        for x in range(w):
            if (x,y) in seen or pix[x,y]==0:
                continue
            q=[(x,y)]; seen.add((x,y)); pts=[]
            while q:
                px,py=q.pop(); pts.append((px,py))
                for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                    if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and pix[nx,ny]!=0:
                        seen.add((nx,ny)); q.append((nx,ny))
            xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
            bx=(min(xs),min(ys),max(xs)+1,max(ys)+1)
            bw=bx[2]-bx[0]; bh=bx[3]-bx[1]
            area=len(pts); fill=area/max(1,bw*bh)
            out.append({'area':area,'bbox':bx,'w':bw,'h':bh,'fill':fill,'cx':sum(xs)/area,'cy':sum(ys)/area})
    return out


def analyze(path):
    im=Image.open(path).convert('RGBA')
    w,h=im.size
    rgba=im.load()
    alpha=Image.new('L',(w,h),0); ap=alpha.load()
    green=Image.new('L',(w,h),0); gp=green.load()
    for y in range(h):
        for x in range(w):
            r,g,b,a=rgba[x,y]
            if a>40:
                ap[x,y]=255
                # Broad green segmentation: hair + sword. Component scoring below
                # rejects long/thin sword pieces and favors compact hair masses.
                if g>=55 and g>r*1.16 and g>b*1.08 and (g-r)>=12:
                    gp[x,y]=255
    bbox=alpha.getbbox()
    if not bbox:
        return None
    bw=bbox[2]-bbox[0]; bh=bbox[3]-bbox[1]
    opaque=sum(1 for v in alpha.getdata() if v)

    # Morphological opening strips thin sword/cape/hair strands and leaves the
    # dominant anatomical mass. 5px and 9px variants are both logged.
    core5=alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    core9=alpha.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    c5=max(components(core5),key=lambda c:c['area'],default=None)
    c9=max(components(core9),key=lambda c:c['area'],default=None)

    greens=components(green)
    candidates=[]
    for c in greens:
        aspect=c['w']/max(1,c['h'])
        if c['area']<18 or c['w']<3 or c['h']<3:
            continue
        # Compactness strongly demotes the sword; mild preference for candidates
        # above the opaque vertical midpoint keeps compact green VFX/sword pieces
        # from winning when they appear low in an attack frame.
        upper_bonus=1.18 if c['cy'] < (bbox[1]+bbox[3])/2 else 1.0
        aspect_penalty=1.0/(1.0+max(0,aspect-2.2)*1.7+max(0,(1/aspect)-2.8)*.8)
        score=c['area']*(0.45+0.55*c['fill'])*upper_bonus*aspect_penalty
        candidates.append((score,c))
    candidates.sort(reverse=True,key=lambda t:t[0])
    hair=candidates[0][1] if candidates else None

    return {
        'size':(w,h),'bbox':bbox,'bbox_w':bw,'bbox_h':bh,'opaque':opaque,
        'core5':c5,'core9':c9,'hair':hair,
        'hair_score':candidates[0][0] if candidates else 0,
        'green_top':[c for _,c in candidates[:3]],
    }

rows=[]
for action in ACTIONS:
    for direction in DIRS:
        d=ROOT/action/direction
        if not d.exists():
            continue
        for p in sorted(d.glob('frame_*.png')):
            a=analyze(p)
            if a:
                rows.append((action,direction,p.name,a))

print('=== PER-FRAME METRICS ===')
for action,direction,name,a in rows:
    hair=a['hair']; c5=a['core5']; c9=a['core9']
    def fmt(c):
        return 'none' if not c else f"A{c['area']} {c['w']}x{c['h']} fill{c['fill']:.2f} @({c['cx']:.1f},{c['cy']:.1f})"
    print(f"{action:8s} {direction:4s} {name} bbox={a['bbox_w']}x{a['bbox_h']} opaque={a['opaque']} hair={fmt(hair)} core5={fmt(c5)} core9={fmt(c9)}")

print('\n=== ACTION/DIRECTION MEDIANS ===')
summary={}
for action in ACTIONS:
    for direction in DIRS:
        rs=[a for ac,di,_,a in rows if ac==action and di==direction]
        if not rs: continue
        def med(path):
            vals=[]
            for r in rs:
                c=r[path] if path in ('hair','core5','core9') else None
                if c: vals.append(c['area'])
            return median(vals) if vals else None
        vals={
            'bbox_h':median([r['bbox_h'] for r in rs]),
            'bbox_w':median([r['bbox_w'] for r in rs]),
            'opaque':median([r['opaque'] for r in rs]),
            'hair_area':med('hair'),
            'core5_area':med('core5'),
            'core9_area':med('core9'),
            'hair_h':median([r['hair']['h'] for r in rs if r['hair']]) if any(r['hair'] for r in rs) else None,
            'hair_w':median([r['hair']['w'] for r in rs if r['hair']]) if any(r['hair'] for r in rs) else None,
        }
        summary[(action,direction)]=vals
        print(action,direction,vals)

# Suggested state scale from compact green hair area, canonicalized to RUN.
run_hairs=[v['hair_area'] for (a,d),v in summary.items() if a=='run' and v['hair_area']]
canonical=median(run_hairs) if run_hairs else None
print('\n=== SUGGESTED HAIR-AREA SCALE (run canonical) ===')
print('canonical_hair_area',canonical)
if canonical:
    for action in ACTIONS:
        vals=[v['hair_area'] for (a,d),v in summary.items() if a==action and v['hair_area']]
        if not vals: continue
        area=median(vals)
        scale=math.sqrt(canonical/area)
        print(f'{action:8s} hair_area={area:.1f} scale={scale:.4f}')
