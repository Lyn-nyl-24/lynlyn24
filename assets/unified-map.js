// The same deterministic SVG renderer runs at build time and in the browser.
export const mapGroups = {all:'Complete map',appendix:'Appendix D',hoyois:'Hoyois',grothendieck:'Grothendieck',bridges:'Cross-references'};
export const escapeMap = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const h = escapeMap;
const ends = r => [...new Set([...(r.from ?? []),...(r.to ?? []),...(r.participants ?? [])])];
const choices = [
  ['md-open','rl-etale'],['rl-etale','rl-smooth'],['rl-etale','Nis'],['rl-etale','et'],
  ['rl-etale','site-petit-et'],['et','site-gros-et'],['site-petit-et','site-gros-et'],['site-petit-et','found-topos'],
];
const defaultKeys = [...new Set(choices.flat())];
const desktop = [[115,50],[411,50],[707,50],[115,173],[411,173],[707,173],[411,300],[707,300]];
const portrait = [[94,45],[94,146],[286,146],[80,245],[291,245],[98,356],[287,459],[99,459]];

export function mapSelection(model, mode, key) {
  let relations, nodeKeys;
  if (mode === 'start') {
    relations = choices.flatMap(([from,to]) => {
      const match = model.relations.find(r => r.from.length===1 && r.to.length===1 && r.from[0]===from && r.to[0]===to && !(r.participants?.length));
      return match ? [match] : [];
    });
    if (!relations.length) return mapSelection(model,'node',model.nodes.find(n=>n.key==='rl-etale')?.key ?? model.nodes[0]?.key);
    nodeKeys = new Set(relations.flatMap(ends));
  } else if (mode === 'relation') {
    relations = model.relations.filter(r=>r.id===key);
    nodeKeys = new Set(relations.flatMap(ends));
  } else if (mode === 'node') {
    relations = model.relations.filter(r=>ends(r).includes(key));
    nodeKeys = new Set([key,...relations.flatMap(ends)]);
  } else {
    relations = mode === 'all' ? model.relations : model.relations.filter(r=>r.groups.includes(mode));
    nodeKeys = new Set(model.nodes.filter(n=>mode==='all' || n.groups.includes(mode)).map(n=>n.key));
    for (const r of relations) for (const k of ends(r)) nodeKeys.add(k);
  }
  return {nodes:model.nodes.filter(n=>nodeKeys.has(n.key)),relations};
}

function linesFor(name, width, mobile) {
  const limit=Math.floor((width-15)/(mobile?8.9:7.45)), lines=[''];
  for (const word of String(name).split(/\s+/)) {
    if (lines.at(-1) && (lines.at(-1)+' '+word).length>limit) lines.push('');
    // Hyphenate long labels geometrically. The accessible name retains the original text.
    for (let j=0;j<word.length;j+=limit) {
      if (j) lines.push('');
      lines[lines.length-1]+=(lines.at(-1)?' ':'')+word.slice(j,j+limit);
    }
  }
  return lines;
}

function geometry(rows, mode, mobile) {
  const width=mobile?145:186;
  const nodes=new Map(rows.nodes.map(n=>{
    const lines=linesFor(n.name,width,mobile),leading=mobile?19:16;
    return [n.key,{...n,width,height:Math.max(40,lines.length*leading+14),leading,lines,x:0,y:0}];
  }));
  if (mode==='start' && [...nodes.keys()].every(k=>defaultKeys.includes(k))) {
    const positions=mobile?portrait:desktop;
    for (const [k,n] of nodes) [n.x,n.y]=positions[defaultKeys.indexOf(k)];
    return {nodes,w:mobile?384:822,h:mobile?515:354};
  }
  // Directed incidence provides a reading order. Symmetric statements exert
  // proximity only; they never impose an order on the mathematical objects.
  const neighbors=new Map([...nodes.keys()].map(k=>[k,new Set()]));
  const rank=new Map([...nodes.keys()].map(k=>[k,0]));
  for (const r of rows.relations) {
    const members=ends(r);
    for (const a of members) for (const b of members) if(a!==b) neighbors.get(a)?.add(b);
    if (r.directed) {
      for(const k of r.from)rank.set(k,(rank.get(k)??0)-1);
      for(const k of r.to)rank.set(k,(rank.get(k)??0)+1);
    }
  }
  const compare=(a,b)=>(rank.get(a)-rank.get(b)) || (nodes.get(a).name.localeCompare(nodes.get(b).name,'en')) || a.localeCompare(b);
  const ordered=[...nodes.keys()].sort(compare);
  const cols=Math.min(ordered.length || 1, mobile ? Math.max(2,Math.round(Math.sqrt(ordered.length)*.72)) : Math.max(3,Math.ceil(Math.sqrt(ordered.length*1.75))));
  const nRows=Math.max(1,Math.ceil(ordered.length/cols));
  const colOf=new Map(ordered.map((k,i)=>[k,Math.floor(i/nRows)]));
  const buckets=Array.from({length:cols},()=>[]);
  for (const k of ordered) buckets[colOf.get(k)].push(k);
  const pos=new Map(ordered.map((k,i)=>[k,i%nRows]));
  for (let sweep=0;sweep<4;sweep++) {
    for(let step=0;step<cols;step++) {
      const c=sweep%2?cols-1-step:step;
      const bin=buckets[c];
      const mean=k=>{
        const adjacent=[...(neighbors.get(k)??[])].filter(n=>colOf.get(n)!==c);
        return adjacent.reduce((sum,n)=>sum+pos.get(n),pos.get(k))/(adjacent.length+1);
      };
      const values=new Map(bin.map(k=>[k,mean(k)]));
      bin.sort((a,b)=>values.get(a)-values.get(b)||compare(a,b));
      bin.forEach((k,i)=>pos.set(k,i));
    }
  }
  const dx=width+(mobile?40:75),dy=Math.max(100,...[...nodes.values()].map(n=>n.height+47));
  const w=cols*dx+16, height=nRows*dy+20;
  for(const [k,n] of nodes) {
    const c=colOf.get(k);
    n.x=8+dx*(c+.5);
    n.y=10+dy*(pos.get(k)+.5+(nRows-buckets[c].length)/2);
  }
  return {nodes,w,h:height};
}

function boundary(n, toward) {
  const dx=toward.x-n.x,dy=toward.y-n.y;
  const t=Math.min((n.width/2+2)/Math.max(.01,Math.abs(dx)),(n.height/2+2)/Math.max(.01,Math.abs(dy)));
  return [n.x+dx*t,n.y+dy*t];
}
function curve(a,b,offset=0) {
  if(a===b)return {d:`M${a.x-22} ${a.y-a.height/2}c-24 -55 70 -55 47 0`,x:a.x,y:a.y-a.height/2-35};
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  const x=(a.x+b.x)/2-dy*offset/len, y=(a.y+b.y)/2+dx*offset/len;
  const p=boundary(a,{x,y}),q=boundary(b,{x,y});
  return {d:`M${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${x.toFixed(1)} ${y.toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`,
    x:(p[0]+2*x+q[0])/4,y:(p[1]+2*y+q[1])/4,points:[p,[x,y],q]};
}
function line(d,klass,arrows='') {
  return `<path class="um-hit" d="${d}"/><path class="um-line ${klass}" d="${d}" ${arrows}/>`;
}
// Use a clear curve when possible. If it would disappear behind another object,
// seek a horizontal aisle with short vertical approaches in the column gutters.
function router(nodes,w,height) {
  const boxes=[...nodes.values()];
  const aisles=[5,height-5,...new Set(boxes.flatMap(n=>[n.y-n.height/2-9,n.y+n.height/2+9]))];
  const inside=(x,y,n)=>Math.abs(x-n.x)<n.width/2+2 && Math.abs(y-n.y)<n.height/2+2;
  return (a,b,offset=0)=>{
    const direct=curve(a,b,offset);
    if(!direct.points)return direct;
    const other=boxes.filter(n=>n!==a && n!==b);
    const [p,c,q]=direct.points;
    const nearby=other.filter(n=>n.x+n.width/2+2>=Math.min(p[0],c[0],q[0]) && n.x-n.width/2-2<=Math.max(p[0],c[0],q[0]) &&
      n.y+n.height/2+2>=Math.min(p[1],c[1],q[1]) && n.y-n.height/2-2<=Math.max(p[1],c[1],q[1]));
    const steps=Math.max(12,Math.ceil((Math.hypot(c[0]-p[0],c[1]-p[1])+Math.hypot(q[0]-c[0],q[1]-c[1]))/8));
    let blocked=false;
    for(let i=0;i<=steps&&!blocked;i++){
      const t=i/steps,u=1-t,x=u*u*p[0]+2*u*t*c[0]+t*t*q[0],y=u*u*p[1]+2*u*t*c[1]+t*t*q[1];
      blocked=nearby.some(n=>inside(x,y,n)) || x<1 || x>w-1 || y<1 || y>height-1;
    }
    if(!blocked)return direct;
    const intersects=(x,y,xx,yy)=>other.some(n=>
      Math.max(x,xx)>n.x-n.width/2-2 && Math.min(x,xx)<n.x+n.width/2+2 &&
      Math.max(y,yy)>n.y-n.height/2-2 && Math.min(y,yy)<n.y+n.height/2+2);
    const towards=a.x<=b.x?1:-1,corridors=aisles.slice().sort((x,y)=>Math.abs(x-direct.y)-Math.abs(y-direct.y));
    for(const ay of corridors){
      if(ay<3||ay>height-3)continue;
      for(const [sa,sb] of [[towards,-towards],[towards,towards],[-towards,-towards],[-towards,towards]]) {
        const x0=a.x+sa*(a.width/2+2),x1=b.x+sb*(b.width/2+2);
        const extra=10+Math.min(5,Math.abs(offset)/16),ax=x0+sa*extra,bx=x1+sb*extra;
        if(Math.min(ax,bx)<3||Math.max(ax,bx)>w-3)continue;
        if(intersects(x0,a.y,ax,a.y)||intersects(ax,a.y,ax,ay)||intersects(ax,ay,bx,ay)||
          intersects(bx,ay,bx,b.y)||intersects(bx,b.y,x1,b.y))continue;
        return {d:`M${x0} ${a.y}H${ax}V${ay}H${bx}V${b.y}H${x1}`,x:(ax+bx)/2,y:ay};
      }
    }
    return direct;
  };
}
function joinPoint(members,target,shift) {
  const x=members.reduce((s,n)=>s+n.x,0)/members.length,y=members.reduce((s,n)=>s+n.y,0)/members.length;
  const dx=target.x-x,dy=target.y-y,length=Math.hypot(dx,dy)||1;
  return {x:x+.32*dx-shift*dy/length,y:y+.32*dy+shift*dx/length,width:16,height:16};
}
const average = list => ({x:list.reduce((s,n)=>s+n.x,0)/list.length,y:list.reduce((s,n)=>s+n.y,0)/list.length});
const mark = (n,s) => `<g class="um-mark" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})"><rect x="-9" y="-9" width="18" height="18" rx="2"/><text y="4">${s}</text></g>`;
function relationShape(r,nodes,prefix,verbose,bend,route) {
  const as=r.from.map(k=>nodes.get(k)).filter(Boolean),bs=r.to.map(k=>nodes.get(k)).filter(Boolean);
  const context=(r.participants??[]).filter(k=>!r.from.includes(k)&&!r.to.includes(k)).map(k=>nodes.get(k)).filter(Boolean);
  const all=[...as,...bs,...context];
  if (!all.length) return '';
  const leg=(a,b,klass)=>line(route(a,b).d,klass);
  let paths='',marks='',badge;
  const symmetric=r.kind==='equivalence'||r.kind==='poset-isomorphism';
  const directional=r.directed && as.length && bs.length;
  const opposite=symmetric && directional;
  const arrows=directional ? `marker-end="url(#${prefix}-head)"${opposite?' marker-start="url(#'+prefix+'-head)"':''}` : '';
  if(as.length&&bs.length&&(directional || (as.length===1 && bs.length===1))) {
    const a=as.length===1?as[0]:joinPoint(as,average(bs),bend-15);
    const b=bs.length===1?bs[0]:joinPoint(bs,average(as),-bend-15);
    // Spokes are membership in a tuple, not arrows from/to individual assumptions.
    if(as.length>1){paths+=as.map(n=>leg(n,a,'um-member')).join('');marks+=mark(a,'∧');}
    if(bs.length>1){paths+=bs.map(n=>leg(b,n,'um-member')).join('');marks+=mark(b,'∧');}
    const p=route(a,b,bend);
    paths+=line(p.d,'',arrows);
    badge={x:p.x,y:p.y,width:8,height:8};
    for(const n of context)paths+=leg(n,badge,'um-context');
  } else {
    const p=average(all);badge={x:p.x+17,y:p.y-18,width:13,height:13};
    for(const n of [...new Set([...as,...bs])])paths+=leg(n,badge,'um-member');
    for(const n of context)paths+=leg(n,badge,'um-context');
    marks+=mark(badge,symmetric?'≃':'·');
  }
  const short=r.conditional?'if':symmetric?'≃':r.kind==='class-inclusion'?'⊆':null;
  if(verbose && short && as.length && bs.length){
    marks+=`<g class="um-edge-badge" transform="translate(${badge.x.toFixed(1)} ${badge.y.toFixed(1)})"><rect x="-11" y="-8" width="22" height="16" rx="6"/><text y="4">${h(short)}</text></g>`;
  }
  const label=[r.label,r.kind,r.condition].filter(Boolean).join(' · ');
  const groups=r.groups ?? [];
  return `<a class="um-edge ${groups.includes('bridges')?'um-bridge':''} ${!directional?'um-undirected':''}" href="#unified-relation-${h(r.id)}" aria-label="${h(label)}"><title>${h(label)}</title>${paths}${marks}</a>`;
}
function nodeShape(n,selected) {
  const first=n.groups?.find(g=>g!=='bridges')??'bridges';
  return `<a class="um-node um-group-${h(first)}${n.key===selected?' um-selected':''}" href="#unified-node-${h(n.key)}" aria-label="${h(n.name)}"><title>${h(n.name)}</title><g transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})"><rect x="${-n.width/2}" y="${-n.height/2}" width="${n.width}" height="${n.height}" rx="3"/><text>${n.lines.map((line,i)=>`<tspan x="0" y="${(i-(n.lines.length-1)/2)*n.leading+5}">${h(line)}</tspan>`).join('')}</text></g></a>`;
}
export function mapSvg(model,{mode='start',key='',mobile=false,prefix='um-live'}={}) {
  const rows=mapSelection(model,mode,key);
  const {nodes,w,h:height}=geometry(rows,mode,mobile);
  const route=router(nodes,w,height);
  const taken=new Map();
  const shapes=rows.relations.map(r=>{
    const pair=[r.from.slice().sort().join(','),r.to.slice().sort().join(',')].sort().join('|');
    const occurrence=taken.get(pair)??0;taken.set(pair,occurrence+1);
    const bend=mode==='start' && mobile && r.from[0]==='rl-etale' && r.to[0]==='site-petit-et'
      ? -188 : occurrence===0?0:(occurrence%2?1:-1)*Math.ceil(occurrence/2)*34;
    return relationShape(r,nodes,prefix,rows.relations.length<95,bend,route);
  }).join('');
  const label=mode==='start'?'Étale morphisms, topology and sites':mode==='node'?nodes.get(key)?.name??'Selected record':mode==='relation'?rows.relations[0]?.label??'Selected relation':mapGroups[mode]??'Map';
  return {count:rows.nodes.length,edges:rows.relations.length,label,w,height,focus:nodes.get(key),
    markup:`<svg class="um-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" role="group" aria-label="${h(label)}"><defs><marker id="${prefix}-head" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="9" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path class="um-arrow" d="M1 1 L9 4 1 7"/></marker></defs>${shapes}${[...nodes.values()].map(n=>nodeShape(n,key)).join('')}</svg>`};
}

function initializeMap(root) {
  const find=selector=>root.querySelector(selector);
  const model=JSON.parse(find('[data-um-model]').content.textContent);
  const stage=find('[data-um-stage]'), view=find('[data-um-view]'), node=find('[data-um-node]'), relation=find('[data-um-relation]');
  const status=find('[data-um-status]'), inspect=find('[data-um-inspect]');
  const small=window.matchMedia('(max-width: 640px)');
  const nodes=new Map(model.nodes.map(n=>[n.key,n])),records=new Map(model.relations.map(r=>[r.id,r]));
  let mode='start',key='',diagram,viewport,lastGesture=0;
  function fitNodeLabels() {
    const adjusted=[];
    for(const group of stage.querySelectorAll('.um-node g')) {
      const available=group.querySelector('rect').width.baseVal.value-10;
      for(const span of group.querySelectorAll('tspan')){
        if(span.getComputedTextLength()>available)adjusted.push([span,available]);
      }
    }
    for(const [span,width] of adjusted){
      span.setAttribute('lengthAdjust','spacingAndGlyphs');
      span.setAttribute('textLength',String(width));
    }
  }
  function describe(kind,id) {
    const record=kind==='relation'?records.get(id):nodes.get(id);
    if(!record)return;
    const link=document.createElement('a');
    link.href='#unified-'+kind+'-'+id;
    link.textContent=kind==='relation'?record.label:record.name;
    inspect.replaceChildren(link);
    if(kind==='relation') {
      const detail=[record.kind,record.condition].filter(Boolean).join(' · ');
      if(detail)inspect.append(document.createTextNode(' · '+detail));
    } else if(record.topic)inspect.append(document.createTextNode(' · '+record.topic));
    inspect.hidden=false;
  }
  function box() {
    const w=diagram.w/viewport.zoom, h=diagram.height/viewport.zoom;
    viewport.x=Math.max(w/2,Math.min(diagram.w-w/2,viewport.x));
    viewport.y=Math.max(h/2,Math.min(diagram.height-h/2,viewport.y));
    stage.querySelector('svg').setAttribute('viewBox',[viewport.x-w/2,viewport.y-h/2,w,h].join(' '));
    stage.classList.toggle('um-can-pan',viewport.zoom>1);
    find('[data-um-out]').disabled=viewport.zoom<=1;
    find('[data-um-in]').disabled=viewport.zoom>=16;
    find('[data-um-fit]').disabled=viewport.zoom<=1;
  }
  function fit() {
    viewport={x:diagram.w/2,y:diagram.height/2,zoom:1};box();
  }
  function choose(next,id='') {
    if(next==='node' && !nodes.has(id) || next==='relation' && !records.has(id))return;
    mode=next;key=id;
    let focused=view.querySelector('[value="focus"]');
    if(mode==='node'||mode==='relation'){
      if(!focused){focused=document.createElement('option');focused.value='focus';view.append(focused);}
      focused.textContent=mode==='node'?'Object neighborhood':'One relation';
      view.value='focus';
    } else {focused?.remove();view.value=mode;}
    node.value=mode==='node'?id:'';
    relation.value=mode==='relation'?id:'';
    diagram=mapSvg(model,{mode,key,mobile:small.matches});
    stage.innerHTML=diagram.markup;
    status.textContent=diagram.label+' · '+diagram.count+' objects · '+diagram.edges+' relations';
    fit();
    if(mode==='node' && diagram.focus) {
      const scale=Math.min(stage.clientWidth/diagram.w,stage.clientHeight/diagram.height);
      if(scale>0 && scale<.78) {
        viewport={x:diagram.focus.x,y:diagram.focus.y,zoom:Math.min(16,.84/scale)};
        box();
      }
    }
    fitNodeLabels();
    if(mode==='node'||mode==='relation')describe(mode,key);else inspect.hidden=true;
  }
  function readHash(hash,reveal=false,select=true) {
    const match=/^#unified-(node|relation)-(.+)$/.exec(hash);
    if(!match)return;
    let id;try{id=decodeURIComponent(match[2]);}catch{return;}
    if(!(match[1]==='node'?nodes:records).has(id))return;
    if(reveal){
      let target=document.getElementById('unified-'+match[1]+'-'+id);
      for(let d=target?.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;
    }
    if(select && (mode!==match[1]||key!==id))choose(match[1],id);
  }
  function zoom(factor) {
    viewport.zoom=Math.min(16,Math.max(1,viewport.zoom*factor));box();
  }
  function svgPoint(event) {
    const svg=stage.querySelector('svg'),ctm=svg.getScreenCTM();
    if(!ctm)return null;
    return new DOMPoint(event.clientX,event.clientY).matrixTransform(ctm.inverse());
  }
  let drag=null;
  stage.addEventListener('pointerdown',event=>{
    if(viewport.zoom<=1||event.button!==0)return;
    // Capture only after movement so an ordinary click follows its evidence link.
    const point=svgPoint(event);
    if(point)drag={id:event.pointerId,x:event.clientX,y:event.clientY,point,moved:false};
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.moved && Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
    drag.moved=true;stage.setPointerCapture(event.pointerId);
    const point=svgPoint(event);if(!point)return;
    viewport.x+=drag.point.x-point.x;viewport.y+=drag.point.y-point.y;box();
  });
  function release(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(drag.moved)lastGesture=performance.now();
    if(stage.hasPointerCapture(drag.id))stage.releasePointerCapture(drag.id);
    drag=null;
  }
  for(const name of ['pointerup','pointercancel','pointerleave'])stage.addEventListener(name,event=>{
    if(name!=='pointerleave'||!drag?.moved)release(event);
  });
  stage.addEventListener('click',event=>{
    if(lastGesture && performance.now()-lastGesture<250){event.preventDefault();event.stopPropagation();}
  },true);
  stage.addEventListener('keydown',event=>{
    if(event.target!==stage || event.ctrlKey || event.metaKey || event.altKey)return;
    const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(step && viewport.zoom>1){viewport.x+=step[0]*diagram.w/viewport.zoom*.18;viewport.y+=step[1]*diagram.height/viewport.zoom*.18;box();}
    else if(event.key==='+' || event.key==='=')zoom(1.6);
    else if(event.key==='-')zoom(1/1.6);
    else if(event.key==='Home')fit();
    else return;
    event.preventDefault();
  });
  view.addEventListener('change',()=>{if(view.value!=='focus')choose(view.value);});
  node.addEventListener('change',()=>{if(node.value)choose('node',node.value);});
  relation.addEventListener('change',()=>{if(relation.value)choose('relation',relation.value);});
  find('[data-um-in]').addEventListener('click',()=>zoom(1.6));
  find('[data-um-out]').addEventListener('click',()=>zoom(1/1.6));
  find('[data-um-fit]').addEventListener('click',fit);
  function inspectLink(event) {
    const anchor=event.target.closest?.('a[href^="#unified-"]');
    const m=anchor?.getAttribute('href').match(/^#unified-(node|relation)-(.+)$/);
    if(m)describe(m[1],m[2]);
  }
  stage.addEventListener('focusin',inspectLink);
  stage.addEventListener('pointerover',event=>{if(event.pointerType==='mouse')inspectLink(event);});
  small.addEventListener('change',()=>choose(mode,key));
  window.addEventListener('hashchange',()=>readHash(location.hash,true));
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
    const anchor=event.target.closest?.('a[href]');
    if(!anchor || anchor.hasAttribute('download') || anchor.getAttribute('target')==='_blank')return;
    const url=new URL(anchor.getAttribute('href'),location.href);
    if(url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search)return;
    // Let the native link navigate/focus the evidence after disclosure expansion.
    readHash(url.hash,true,false);
    // Native activation completes while the original SVG link is still attached.
    if(url.hash===location.hash)setTimeout(()=>readHash(url.hash),0);
  });
  choose('start');readHash(location.hash,true);
  if(document.fonts)document.fonts.ready.then(fitNodeLabels);
  find('[data-um-controls]').hidden=false;
  find('[data-um-zoom]').hidden=false;
}

if(typeof document!=='undefined') {
  for(const root of document.querySelectorAll('[data-unified-map]'))initializeMap(root);
}
