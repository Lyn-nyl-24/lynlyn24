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
  const nodes = new Map([...svg.querySelectorAll('[data-node]')].map(el => [el.dataset.node,el]));
  const edges = new Map([...svg.querySelectorAll('[data-edge]')].map(el => [el.dataset.edge,el]));
  const relations = new Map(model.relations.map(r => [r.id,r]));
  const incident = row => [...new Set([...row.from,...row.to,...row.participants])];
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
    for(const el of svg.querySelectorAll('.topo-current,.topo-later,.topo-prior,.um-related,.um-chosen'))
      el.classList.remove('topo-current','topo-later','topo-prior','um-related','um-chosen');
  }
  function trace(edge) {
    if (!edge) return;
    const group=document.createElementNS(svg.namespaceURI,'g');
    group.setAttribute('class',edge.getAttribute('class')+' um-chosen');
    for(const shape of edge.querySelectorAll(':scope > .um-line,:scope > .um-mark')) group.append(shape.cloneNode(true));
    overlay.append(group);
  }
  function select(type,key,locate=false) {
    const isNode=type==='node', el=(isNode?nodes:edges).get(key);
    if(!el)return;
    const record=document.getElementById('unified-'+type+'-'+key);
    if(!record)return;
    clearMarks(); selection=el;
    nodeSelect.value=isNode?key:''; relationSelect.value=isNode?'':key;
    if(isNode) {
      for(const [k,state] of selectionStates(model.relations,key,nodes.keys())) nodes.get(k).classList.add('topo-'+state);
      for(const row of model.relations) if(incident(row).includes(key))trace(edges.get(row.id));
    } else {
      el.classList.add('um-chosen');trace(el);
      for(const k of incident(relations.get(key)))nodes.get(k).classList.add('um-related');
    }
    const heading=document.createElement('strong');
    heading.textContent=record.parentElement.querySelector('summary').textContent;
    const hypothesis=[...record.children].find(p=>p.querySelector(':scope > strong')?.textContent==='Hypotheses.');
    const detail=hypothesis ?? (isNode?record.children[1]:record.firstElementChild);
    const paragraph=document.createElement('p');
    paragraph.textContent=detail?.textContent ?? '';
    const links=document.createElement('p'),permalink=document.createElement('a');
    permalink.href='#'+record.id;permalink.textContent='Full record';
    links.append(permalink);
    const seen=new Set();
    for(const a of record.querySelectorAll('a[href^="https://"]')){
      if(seen.has(a.href))continue;
      seen.add(a.href); links.append(' · ',a.cloneNode(true));
    }
    content.replaceChildren(heading,paragraph,links);inspector.hidden=false;
    find('[data-um-status]').textContent=heading.textContent;
    if(locate) {
      if(isNode) camera(readingScale(),centreOf(el));
      else {
        const boxes=[el,...incident(relations.get(key)).map(k=>nodes.get(k))].map(a=>a.getBBox());
        const x=Math.min(...boxes.map(r=>r.x)), y=Math.min(...boxes.map(r=>r.y));
        const w=Math.max(...boxes.map(r=>r.x+r.width))-x, h=Math.max(...boxes.map(r=>r.y+r.height))-y;
        camera(Math.min(readingScale(),width/(w+42),height/(h+42)),{x:x+w/2,y:y+h/2});
      }
    }
  }
  function clear() {
    clearMarks(); selection=null;nodeSelect.value=relationSelect.value='';
    inspector.hidden=true;content.replaceChildren();
    find('[data-um-status]').textContent=model.nodes.length+' objects · '+model.relations.length+' relations';
  }
  for(const [el,type] of [[nodeSelect,'node'],[relationSelect,'relation']])
    el.addEventListener('change',()=>el.value?select(type,el.value,true):clear());
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
    select(a.hasAttribute('data-node')?'node':'relation',a.dataset.node??a.dataset.edge);
  });
  function disclose(hash) {
    if(!/^#(?:unified-(?:node|relation)-|top-morphisms-|edge-morphisms-)/.test(hash))return;
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
