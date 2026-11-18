export function selectionStates(relations,selected,visible) {
  const rules=[];
  for (const r of relations) {
    if (!r.directed || r.conditional || r.condition || !['implication','equivalence'].includes(r.kind)) continue;
    rules.push([r.from,r.to]);
    if(r.kind==='equivalence')rules.push([r.to,r.from]);
  }
  function closure(seed) {
    const known=new Set([seed]);
    let previous;
    do {
      previous=known.size;
      for(const [inputs,outputs] of rules) if(inputs.every(k=>known.has(k))) for(const k of outputs)known.add(k);
    } while(known.size!==previous);
    return known;
  }
  const follows=closure(selected),states=new Map([[selected,'current']]);
  for(const k of visible) {
    if(k===selected)continue;
    if(follows.has(k))states.set(k,'later');
    else if(closure(k).has(selected))states.set(k,'prior');
  }
  return states;
}

// The complete sheet is printed in the document. Interaction only moves the
// camera, marks existing geometry and opens the record linked by the drawing.
function initializeMap(root) {
  const find = selector => root.querySelector(selector);
  const model = JSON.parse(find('[data-um-model]').content.textContent);
  const stage = find('[data-um-stage]'), svg = stage.querySelector('svg');
  const nodeSelect = find('[data-um-node]'), relationSelect = find('[data-um-relation]');
  const inspector = find('[data-um-inspect]'), content = find('[data-um-record]');
  const nodes = new Map(), edges = new Map();
  const names = new Map(model.nodes.map(n => [n.key,n.name]));
  const relations = new Map(model.relations.map(r => [r.id,r]));
  const incident = row => [...new Set([...row.from,...row.to,...row.participants])];
  const byObject = new Map(model.nodes.map(n=>[n.key,[]]));
  for (const r of model.relations) for (const k of incident(r)) byObject.get(k).push(r.id);
  for (const el of svg.querySelectorAll('[data-members]'))
    for (const key of el.dataset.members.split(' ')) nodes.set(key,el);
  for (const el of svg.querySelectorAll('[data-records]'))
    for (const id of el.dataset.records.split(' ')) edges.set(id,el);
  let origin=null;
  const back=find('[data-um-back]');
  const recordFor=(type,key)=>document.getElementById('unified-'+type+'-'+key);
  const box = svg.viewBox.baseVal, width = box.width, height = box.height;
  const limit = (v,min,max) => Math.max(min,Math.min(max,v));
  let scale = 1, centre = {x:width/2,y:height/2}, selection;
  const centreOf = el => { const r=el.getBBox(); return {x:r.x+r.width/2,y:r.y+r.height/2}; };
  const readingScale = () => limit(width / svg.getBoundingClientRect().width,1,32);
  function camera(next, point = centre) {
    scale = limit(next,1,32);
    const w=width/scale, h=height/scale;
    centre={x:limit(point.x,w/2,width-w/2),y:limit(point.y,h/2,height-h/2)};
    svg.setAttribute('viewBox',[centre.x-w/2,centre.y-h/2,w,h].join(' '));
    stage.classList.toggle('um-can-pan',scale>1);
    find('[data-um-out]').disabled=scale===1;
    find('[data-um-in]').disabled=scale===32;
  }
  function focusPoint(){
    const path=selection?.querySelector('path.um-line:not(.um-context,.um-member)');
    if(path)return path.getPointAtLength(path.getTotalLength()/2);
    return selection ? centreOf(selection) : centreOf(nodes.get('rl-etale'));
  }
  function zoom(factor){
    camera(scale*factor,scale===1 ? focusPoint() : centre);
  }
  const overlay = svg.querySelector('[data-um-trace]');
  function clearMarks() {
    overlay.replaceChildren();
    for(const el of svg.querySelectorAll('.um-edge[tabindex="-1"]'))el.removeAttribute('tabindex');
    for(const el of svg.querySelectorAll('.um-active,.topo-current,.topo-later,.topo-prior,.um-related,.um-chosen'))
      el.classList.remove('um-active','topo-current','topo-later','topo-prior','um-related','um-chosen');
    svg.classList.remove('um-focused');
  }
  function illuminate(ids) {
    clearMarks();
    svg.classList.add('um-focused');
    const activeEdges=new Set(ids.map(id=>edges.get(id)));
    for(const el of svg.querySelectorAll('a.um-edge'))if(!activeEdges.has(el))el.setAttribute('tabindex','-1');
    for(const edge of activeEdges) {
      edge.classList.add('um-active');
      const group=document.createElementNS(svg.namespaceURI,'g');
      group.setAttribute('class',edge.getAttribute('class')+' um-traced');
      if(ids.length===1)group.classList.add('um-chosen');
      for(const shape of edge.querySelectorAll(':scope > .um-line,:scope > .um-mark,:scope > .um-source-condition')){
        if(shape.matches('path')){
          const casing=document.createElementNS(svg.namespaceURI,'path');
          casing.setAttribute('d',shape.getAttribute('d'));casing.setAttribute('class','um-casing');
          group.append(casing);
        }
        group.append(shape.cloneNode(true));
      }
      overlay.append(group);
    }
    const keys=new Set(ids.flatMap(id=>incident(relations.get(id))));
    for(const k of keys)nodes.get(k).classList.add('um-active');
    return keys;
  }
  function element(tag,text) {
    const el=document.createElement(tag);
    if(text!==undefined)el.textContent=text;
    return el;
  }
  function link(href,label) {
    const a=element('a',label);a.setAttribute('href',href);return a;
  }
  function chooseRows(ids) {
    const list=element('ul');list.className='um-choices';
    for(const id of ids){
      const li=element('li'),button=element('button',relations.get(id).label);
      button.type='button';button.dataset.umChoice=id;li.append(button);list.append(li);
    }
    return list;
  }
  function openPanel(title,parts) {
    const heading=element('h4',title);
    heading.tabIndex=-1;
    content.replaceChildren(heading,...parts);
    inspector.hidden=false;
    back.hidden=!origin || selection===origin.el && !relationSelect.value;
    inspector.scrollTop=0;
    find('[data-um-status]').textContent=title;
  }
  function selectNode(key,locate=false,whole=false) {
    const el=nodes.get(key);
    const keys=whole?el.dataset.members.split(' '):[key];
    origin={key,keys,el,whole};
    const ids=[...new Set(keys.flatMap(k=>byObject.get(k)))];
    const adjacent=illuminate(ids);
    el.classList.add('um-active','topo-current');
    if(keys.length===1)for(const [k,state] of selectionStates(model.relations,key,adjacent)){
      if(nodes.get(k)!==el)nodes.get(k).classList.add('topo-'+state);
    }
    selection=el;nodeSelect.value=key;relationSelect.value='';
    const parts=[element('p',ids.length?ids.length+' connected relations':'No direct relation is recorded here.')];
    if(keys.length>1 && el.dataset.groupNote)parts.unshift(element('p',el.dataset.groupNote));
    if(ids.length)parts.push(chooseRows(ids));
    const definitions=element('p');
    for(const k of keys){
      if(definitions.childNodes.length)definitions.append(' · ');
      definitions.append(link('#unified-node-'+k,keys.length===1?'Definition and references':names.get(k)));
    }
    parts.push(definitions);
    openPanel(keys.length===1?names.get(key):el.getAttribute('aria-label'),parts);
    if(locate)camera(readingScale(),centreOf(el));
    origin.camera={scale,point:{...centre},scrollY:window.scrollY};
  }
  function locateRelation(el,keys) {
    const boxes=[el,...keys.map(k=>nodes.get(k))].map(a=>a.getBBox());
    const x=Math.min(...boxes.map(r=>r.x)), y=Math.min(...boxes.map(r=>r.y));
    const w=Math.max(...boxes.map(r=>r.x+r.width))-x, h=Math.max(...boxes.map(r=>r.y+r.height))-y;
    const point={x:x+w/2,y:y+h/2};
    const top=Math.max(0,document.querySelector('.site-header')?.getBoundingClientRect().bottom??0)+12;
    const bottom=window.innerHeight-inspector.getBoundingClientRect().height-14;
    const available=Math.max(80,bottom-top);
    const units=width/svg.getBoundingClientRect().width;
    camera(Math.min(readingScale(),width/(w+42),available*units/(h+42)),point);
    const middle=new DOMPoint(point.x,point.y).matrixTransform(svg.getScreenCTM());
    window.scrollBy(0,middle.y-(top+available/2));
  }
  function selectRelation(id,locate=false) {
    const row=relations.get(id),el=edges.get(id),record=recordFor('relation',id);
    const keys=illuminate([id]);
    selection=el;el.classList.add('um-chosen');relationSelect.value=id;
    for(const k of keys)nodes.get(k).classList.add('um-related');
    // Copy the rendered mathematical markup and keep every source, including
    // local reading links and database records. The original anchors stay put.
    const hyp=[...record.children].find(p=>p.querySelector(':scope > strong')?.textContent==='Hypotheses.');
    const first=record.querySelector(':scope > section > p');
    const parts=[hyp ? hyp.cloneNode(true) : element('p','No additional hypothesis is recorded.')];
    const refs=element('p');refs.className='um-sources';
    const seen=new Set();
    for(const a of record.querySelectorAll(':scope > section a[href]')){
      if(seen.has(a.href))continue;
      seen.add(a.href);refs.append(a.cloneNode(true));
    }
    if(seen.size)parts.push(refs);
    for(const p of record.querySelectorAll(':scope > p'))if(p!==hyp)parts.push(p.cloneNode(true));
    if(first)parts.push(first.cloneNode(true));
    parts.push(link('#'+record.id,'Full record'));
    openPanel(row.label,parts);
    if(locate)locateRelation(el,[...keys]);
  }
  function choosePath(el) {
    const members=el.dataset.records.split(' ');
    const ids=origin?members.filter(id=>origin.keys.some(k=>incident(relations.get(id)).includes(k))):members;
    if(ids.length===1){selectRelation(ids[0]);return;}
    if(!ids.length)return;
    illuminate(ids);selection=el;relationSelect.value='';
    openPanel('Shared path · '+ids.length+' relations',[chooseRows(ids)]);
    back.hidden=!origin;
  }
  function clear() {
    clearMarks(); origin=null;selection=null;nodeSelect.value=relationSelect.value='';
    inspector.hidden=true;content.replaceChildren();
    find('[data-um-status]').textContent=model.nodes.length+' objects · '+model.relations.length+' relations';
  }
  nodeSelect.addEventListener('change',()=>nodeSelect.value?selectNode(nodeSelect.value,true):clear());
  relationSelect.addEventListener('change',()=>{
    if(!relationSelect.value){clear();return;}
    origin=null;nodeSelect.value='';selectRelation(relationSelect.value,true);
  });
  content.addEventListener('click',e=>{
    const choice=e.target.closest('[data-um-choice]');
    if(choice){selectRelation(choice.dataset.umChoice,true);content.querySelector('h4').focus({preventScroll:true});}
    else if(e.target.closest('a[href^="#unified-"]')&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey)setTimeout(clear,0);
  });
  back.addEventListener('click',()=>{
    if(!origin)return;
    const saved=origin.camera;
    selectNode(origin.key,false,origin.whole);
    camera(saved.scale,saved.point);window.scrollTo(0,saved.scrollY);origin.camera=saved;
    content.querySelector('h4').focus({preventScroll:true});
  });
  inspector.addEventListener('keydown',e=>{if(e.key==='Escape'){clear();stage.focus({preventScroll:true});}});
  find('[data-um-clear]').addEventListener('click',()=>{clear();stage.focus({preventScroll:true});});
  find('[data-um-in]').addEventListener('click',()=>zoom(1.6));
  find('[data-um-out]').addEventListener('click',()=>zoom(1/1.6));
  find('[data-um-fit]').addEventListener('click',()=>camera(1));
  find('[data-um-read]').addEventListener('click',()=>camera(readingScale(),focusPoint()));
  function mousePoint(e){
    return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  }
  stage.addEventListener('dblclick',e=>{
    if(e.target.closest('a'))return;
    camera(scale>1?1:readingScale(),mousePoint(e));e.preventDefault();
  });
  stage.addEventListener('keydown',e=>{
    const step=width/scale*.13;
    switch(e.key){
      case '+': case '=': zoom(1.6);break;
      case '-': zoom(1/1.6);break;
      case 'Home': camera(1);break;
      case 'Escape': clear();break;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
        if(scale===1)return;
        camera(scale,{x:centre.x+({'ArrowLeft':-step,'ArrowRight':step}[e.key]??0),
          y:centre.y+({'ArrowUp':-step,'ArrowDown':step}[e.key]??0)});break;
      default:return;
    }
    e.preventDefault();
  });
  let drag,blockClick=false;
  stage.addEventListener('pointerdown',e=>{
    blockClick=false;
    if(scale<=1||e.button!==0||!e.isPrimary)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,centre:{...centre},moved:false};
  });
  stage.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.moved && Math.hypot(dx,dy)<4)return;
    if(!drag.moved){stage.setPointerCapture(e.pointerId);drag.moved=true;}
    const units=width/(scale*svg.getBoundingClientRect().width);
    camera(scale,{x:drag.centre.x-dx*units,y:drag.centre.y-dy*units});
  });
  function release(e){
    if(!drag||drag.id!==e.pointerId)return;
    blockClick=drag.moved;drag=null;
    if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
  }
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  stage.addEventListener('click',e=>{
    if(blockClick){blockClick=false;e.preventDefault();return;}
    if(e.button!==0||e.ctrlKey||e.shiftKey||e.metaKey||e.altKey)return;
    const a=e.target.closest('a[data-node],a[data-edge]');
    if(!a)return;
    e.preventDefault();
    if(a.hasAttribute('data-node'))selectNode(a.dataset.node,false,true);
    else choosePath(a);
  });
  function disclose(hash) {
    if(!/^#(?:unified-(?:node|relation|route|group)-|top-morphisms-|edge-morphisms-)/.test(hash))return;
    const el=document.getElementById(hash.slice(1));
    for(let parent=el?.closest('details');parent;parent=parent.parentElement.closest('details'))parent.open=true;
  }
  document.addEventListener('click',e=>{
    if(!e.defaultPrevented)disclose(e.target.closest('a[href^="#"]')?.getAttribute('href')??'');
  });
  window.addEventListener('hashchange',()=>disclose(location.hash));
  disclose(location.hash);
  find('[data-um-controls]').hidden=false;
  camera(1);
}

if(typeof document!=='undefined'){
  for(const root of document.querySelectorAll('[data-unified-map]'))initializeMap(root);
}
