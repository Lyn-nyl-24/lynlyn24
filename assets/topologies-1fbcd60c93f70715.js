(() => {
  'use strict';
  const atlas = document.querySelector('.topo-atlas');
  if (!atlas) return;
  atlas.dataset.enhanced = '';
  const compact = matchMedia('(max-width: 42rem)');
  const sections = new Map();
  const entries = new Map();
  let pinned = null;
  let hovered = null;
  let focused = null;
  let shown = null;

  for (const section of atlas.querySelectorAll('[data-graph]')) {
    const canvas = section.querySelector('.topo-canvas');
    const buttons = [...section.querySelectorAll('.topo-board .topo-node, .topo-edge, .topo-index .topo-node, .topo-index-edge')];
    const views = [...section.querySelectorAll('[data-view-choice]')];
    const panel = section.querySelector('.topo-passport');
    const select = section.querySelector('select');
    const fit = section.querySelector('.topo-fit');
    const reset = section.querySelector('.topo-reset');
    const status = section.querySelector('.topo-state');
    const state = { section, buttons, panel, select, reset, status };
    sections.set(section, state);
    for (const entry of section.querySelectorAll('.topo-entry')) entries.set(entry.id, { entry, state });
    section.querySelector('.topo-controls').hidden = false;
    const updateViews = () => {
      const choice = section.dataset.view === 'auto' ? (compact.matches ? 'index' : 'diagram') : section.dataset.view;
      for (const view of views) view.setAttribute('aria-pressed', String(view.dataset.viewChoice === choice));
    };
    for (const view of views) view.addEventListener('click', () => {
      section.dataset.view = view.dataset.viewChoice;
      hovered = focused = null;
      updateViews();
      render();
    });
    compact.addEventListener('change', updateViews);
    updateViews();
    fit.addEventListener('click', () => {
      const fitted = canvas.classList.toggle('topo-fitted');
      fit.setAttribute('aria-pressed', String(fitted));
      fit.textContent = fitted ? 'Full size' : 'Fit diagram';
    });
    reset.addEventListener('click', () => {
      clear();
      select.focus();
    });
    select.addEventListener('change', () => select.value ? pin(select.value, false, true) : clear());
    for (const button of buttons) {
      const id = button.getAttribute('href').slice(1);
      if (button.classList.contains('topo-node')) {
        button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovered = id; render(); } });
        button.addEventListener('pointerleave', () => { if (hovered === id) { hovered = null; render(); } });
      }
      button.addEventListener('focus', () => { focused = id; render(); });
      button.addEventListener('blur', () => { if (focused === id) { focused = null; render(); } });
      button.addEventListener('keydown', event => {
        if (event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        if (!event.repeat) pin(id, true, compact.matches);
      });
    }
  }

  function idsFrom(source, kind) {
    const links = source.querySelectorAll(`dd[data-relation="${kind}"] a[href^="#top-"]`);
    return new Set([...links].map(link => link.hash.slice(1)));
  }

  function relationships(entry) {
    return Object.fromEntries(['prior','later','equal'].map(kind => [kind,idsFrom(entry,kind)]));
  }

  function render() {
    const id = pinned ?? hovered ?? focused;
    const current = entries.get(id);
    const previous = entries.get(shown);
    if (previous && previous.state !== current?.state) {
      previous.state.panel.hidden = true;
      previous.state.panel.replaceChildren();
    }
    const links = current ? relationships(current.entry) : {};
    for (const state of sections.values()) {
      for (const button of state.buttons) {
        const key = button.getAttribute('href').slice(1);
        button.classList.toggle('topo-current', key === id);
        button.classList.toggle('topo-prior', links.prior?.has(key) ?? false);
        button.classList.toggle('topo-later', links.later?.has(key) ?? false);
        button.classList.toggle('topo-equal', links.equal?.has(key) ?? false);
        if (button.classList.contains('topo-edge')) {
          button.classList.toggle('topo-related', button.dataset.from === id || button.dataset.to === id);
        }
        if (key === pinned) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
      const locked = pinned && current?.state === state;
      state.select.value = locked && id.startsWith('top-') ? id : '';
      state.reset.hidden = !locked;
      const announcement = locked ? `Pinned: ${current.entry.dataset.entryName}` : '';
      if (state.status.textContent !== announcement) state.status.textContent = announcement;
    }
    if (current && shown !== id) {
      const heading = document.createElement('h4');
      heading.tabIndex = -1;
      heading.append(current.entry.querySelector('.topo-entry-title').cloneNode(true));
      current.state.panel.replaceChildren(heading, current.entry.querySelector('.topo-entry-body').cloneNode(true));
      current.state.panel.hidden = false;
    }
    shown = id;
  }

  function clear({ keepPreview = false } = {}) {
    if (pinned && location.hash.slice(1) === pinned) history.pushState(null, '', location.pathname + location.search);
    pinned = null;
    if (!keepPreview) hovered = focused = null;
    render();
  }

  function pin(id, toggle = false, reveal = false) {
    if (!entries.has(id)) return;
    if (toggle && pinned === id) { clear({keepPreview:true}); return; }
    pinned = id;
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    render();
    if (reveal) {
      const {panel} = entries.get(id).state;
      panel.querySelector('h4').focus({preventScroll:true});
      panel.querySelector('h4').scrollIntoView({block:'start'});
    } else {
      const heading = entries.get(id).state.panel.querySelector('h4');
      if (heading.getBoundingClientRect().top > window.innerHeight - 100) heading.scrollIntoView({block:'start'});
    }
  }

  atlas.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest('a[href^="#"]');
    const id = a?.getAttribute('href').slice(1);
    if (!entries.has(id)) return;
    event.preventDefault();
    const inDiagram = !!a.closest('.topo-canvas');
    const inIndex = !!a.closest('.topo-index');
    pin(id, inDiagram || inIndex, !inDiagram || compact.matches);
  });
  atlas.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || (!pinned && !shown)) return;
    const source = entries.get(shown);
    const panelHadFocus = source?.state.panel.contains(document.activeElement);
    clear();
    if (panelHadFocus) source.state.select.focus();
  });

  function readHash() {
    const id = location.hash.slice(1);
    pinned = entries.has(id) ? id : null;
    focused = hovered = null;
    render();
    if (pinned) entries.get(pinned).state.panel.querySelector('h4').scrollIntoView({block:'start'});
  }
  addEventListener('hashchange', readHash);
  addEventListener('popstate', readHash);
  if (location.hash) readHash();
})();

(() => {
  'use strict';
  const diagram = document.querySelector('[data-groth-diagram]');
  if (!diagram) return;
  const canvas = diagram.querySelector('[data-groth-canvas]');
  const topicSelect = diagram.querySelector('[data-groth-topics]');
  const nodeSelect = diagram.querySelector('[data-groth-nodes]');
  const find = diagram.querySelector('[data-groth-find]');
  const placeholder = nodeSelect.options[0];
  const normalized = input => input.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
  const nodeGroups = [...nodeSelect.querySelectorAll('optgroup')].map(group => ({
    label:group.label, options:[...group.children].map(option => ({option,text:normalized(option.dataset.search)})),
  }));
  const passport = diagram.querySelector('[data-groth-passport]');
  const controls = diagram.querySelector('.groth-controls');
  const legend = diagram.querySelector('.groth-legend');
  const viewChoices = [...diagram.querySelectorAll('[data-groth-view]')];
  const localControls = diagram.querySelector('[data-groth-local-controls]');
  const localCanvas = diagram.querySelector('[data-groth-local-canvas]');
  const localSvg = localCanvas.querySelector('svg');
  const depthSelect = diagram.querySelector('[data-groth-depth]');
  const kindFilters = [...diagram.querySelectorAll('[data-groth-kind-filter]')];
  const localStatus = diagram.querySelector('[data-groth-local-status]');
  const nodes = new Map(Array.from(diagram.querySelectorAll('[data-groth-node]'), node => [node.dataset.grothNode,node]));
  const edges = new Map(Array.from(diagram.querySelectorAll('[data-groth-edge]'), edge => [edge.dataset.grothEdge,edge]));
  const templates = new Map(Array.from(diagram.querySelectorAll('template[id^="groth-info-"]'), template =>
    [template.id.slice('groth-info-'.length),template]));
  const incident = new Map([...nodes.keys()].map(id => [id,[]]));
  for (const edge of edges.values()) {
    incident.get(edge.dataset.from).push(edge);
    incident.get(edge.dataset.to).push(edge);
  }
  let currentId = '';
  let localRoot = '';
  let local = false;

  function panTo(item) {
    const area = canvas.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    canvas.scrollTo({
      left:canvas.scrollLeft + itemBox.left - area.left - 12,
      top:canvas.scrollTop + itemBox.top - area.top - 12,
    });
  }

  function neighbourhood(root, depth, kinds) {
    const distance = new Map([[root,0]]);
    const queue = [root];
    for (const node of queue) {
      const rank = distance.get(node);
      if (rank === depth) continue;
      for (const {dataset:{from,to,grothKind}} of incident.get(node)) {
        if (!kinds.has(grothKind)) continue;
        const next = from === node ? to : from;
        if (distance.has(next)) continue;
        distance.set(next,rank + 1);
        queue.push(next);
      }
    }
    const levels = Array.from({length:Math.max(...distance.values())+1},(_,rank) =>
      queue.filter(node => distance.get(node) === rank));
    const relations = [...edges.values()].filter(({dataset:{from,to,grothKind}}) =>
      kinds.has(grothKind) && distance.has(from) && distance.has(to));
    return {levels,relations,distance};
  }

  function localPaths(relations, positions, distance, width, height) {
    const lanes = new Map();
    const ports = new Map();
    const paths = relations.map(edge => {
      const {from,to} = edge.dataset;
      const a = positions.get(from);
      const b = positions.get(to);
      const sourceRank = distance.get(from);
      const targetRank = distance.get(to);
      const sameLevel = sourceRank === targetRank;
      const outgoing = sourceRank <= targetRank;
      const fromSide = outgoing ? 'right' : 'left';
      const toSide = sameLevel || !outgoing ? 'right' : 'left';
      const lane = lanes.get(sourceRank) ?? 0;
      const route = {edge, sameLevel, lane, startX:a.x + (fromSide === 'right' ? width+4 : -4),
        endX:b.x + (toSide === 'right' ? width+4 : -4)};
      if (sameLevel) lanes.set(sourceRank,lane+1);
      for (const [id,side,y,port] of [[from,fromSide,a.y,'startY'],[to,toSide,b.y,'endY']]) {
        const key = id + ':' + side;
        if (!ports.has(key)) ports.set(key,[]);
        ports.get(key).push({route,port,y,otherY:port === 'startY' ? b.y : a.y});
      }
      return route;
    });
    for (const users of ports.values()) {
      users.sort((a,b) => a.otherY-b.otherY);
      const step = Math.min(6,(height-14) / Math.max(1,users.length-1));
      for (const [index,{route,port,y}] of users.entries()) {
        route[port] = y + height/2 + step * (index - (users.length-1)/2);
      }
    }
    return paths.map(({edge,sameLevel,lane,startX,startY,endX,endY}) => {
      const turn = startX + 12 + 7 * lane;
      const d = 'M ' + startX + ' ' + startY + (sameLevel ? ' H ' + turn + ' V ' + endY : '') + ' L ' + endX + ' ' + endY;
      const clone = edge.cloneNode(true);
      clone.removeAttribute('id');
      clone.classList.add('is-visible');
      for (const path of clone.querySelectorAll('path')) {
        path.setAttribute('d',d);
        for (const attr of ['marker-start','marker-end']) {
          const marker = path.getAttribute(attr);
          if (marker) path.setAttribute(attr,marker.replace('groth-arrow-','groth-local-arrow-'));
        }
      }
      return clone;
    });
  }

  function drawLocal({reveal=false}={}) {
    localCanvas.hidden = !local || !localRoot;
    if (!local) return;
    if (!localRoot) {
      localSvg.replaceChildren();
      localStatus.textContent = 'Choose a node to see its neighbourhood.';
      return;
    }
    const kinds = new Set(kindFilters.filter(filter => filter.checked).map(filter => filter.value));
    const {levels,relations,distance} = neighbourhood(localRoot,Number(depthSelect.value),kinds);
    const card = nodes.get(localRoot).querySelector('rect');
    const width = Number(card.getAttribute('width'));
    const height = Number(card.getAttribute('height'));
    const sameLevelCount = levels.map((_,rank) => relations.filter(({dataset:{from,to}}) =>
      distance.get(from) === rank && distance.get(to) === rank).length);
    const gap = Math.max(84,...sameLevelCount.map(count => 38+7*count));
    const rows = Math.max(...levels.map(level => level.length));
    const rowHeight = height+20;
    const positions = new Map();
    const drawings = [];
    const labels = [];
    const ns = localSvg.namespaceURI;
    for (const [rank,level] of levels.entries()) {
      const x = 18 + rank * (width+gap);
      const title = document.createElementNS(ns,'text');
      title.setAttribute('class','groth-local-heading');
      title.setAttribute('x',x);
      title.setAttribute('y',26);
      title.textContent = ['Selected node','1 hop','2 hops'][rank];
      labels.push(title);
      for (const [index,id] of level.entries()) {
        const y = 42 + (index + (rows-level.length)/2) * rowHeight;
        positions.set(id,{x,y});
        const clone = nodes.get(id).cloneNode(true);
        const rect = clone.querySelector('rect');
        const dx = x - Number(rect.getAttribute('x'));
        const dy = y - Number(rect.getAttribute('y'));
        clone.removeAttribute('id');
        clone.classList.remove('is-related');
        clone.setAttribute('transform','translate(' + dx + ' ' + dy + ')');
        drawings.push(clone);
      }
    }
    const totalWidth = 36 + levels.length * width + (levels.length-1) * gap + 7 * sameLevelCount.at(-1);
    localSvg.setAttribute('viewBox','0 0 ' + totalWidth + ' ' + (52 + rows * rowHeight));
    localSvg.setAttribute('width',totalWidth);
    localSvg.setAttribute('aria-label','Relations near ' + nodes.get(localRoot).getAttribute('aria-label'));
    const markers = canvas.querySelector('defs').cloneNode(true);
    for (const marker of markers.querySelectorAll('marker')) {
      marker.id = marker.id.replace('groth-arrow-','groth-local-arrow-');
      marker.setAttribute('markerUnits','userSpaceOnUse');
    }
    localSvg.replaceChildren(markers,...labels,...localPaths(relations,positions,distance,width,height),...drawings);
    localStatus.textContent = positions.size + (positions.size === 1 ? ' node · ' : ' nodes · ') +
      relations.length + (relations.length === 1 ? ' relation' : ' relations');
    if (reveal) {
      const selected = localSvg.querySelector('[data-groth-node="' + localRoot + '"]');
      localCanvas.scrollLeft = 0;
      localCanvas.scrollTop = selected.getBoundingClientRect().top - localSvg.getBoundingClientRect().top - 44;
    }
  }

  function selectView(view) {
    local = view === 'local';
    for (const choice of viewChoices) choice.setAttribute('aria-pressed',String(choice.dataset.grothView === view));
    topicSelect.disabled = local;
    canvas.hidden = local;
    legend.hidden = local;
    localControls.hidden = !local;
    nodeSelect.value = local ? localRoot : nodes.has(currentId) ? currentId : '';
    drawLocal({reveal:true});
    const selected = nodes.get(currentId) ?? nodes.get(edges.get(currentId)?.dataset.from);
    if (!local && selected) panTo(selected);
  }

  function display(id,{pan=false,detail=false,historyMode='none'}={}) {
    currentId = id;
    const selectedEdge = edges.get(id);
    const selectedNode = nodes.get(id);
    const nextRoot = selectedNode ? id : selectedEdge ? localRoot || selectedEdge.dataset.from : '';
    const redrawLocal = nextRoot !== localRoot;
    localRoot = nextRoot;
    const active = new Set(selectedEdge ? [selectedEdge.dataset.from,selectedEdge.dataset.to] : [id]);
    const neighbours = new Set();
    for (const [edgeId,edge] of edges) {
      const {from,to} = edge.dataset;
      const visible = selectedEdge ? edgeId === id : active.has(from) || active.has(to);
      edge.classList.toggle('is-visible',visible);
      if (edgeId === id) edge.setAttribute('aria-current','true');
      else edge.removeAttribute('aria-current');
      if (visible) {
        neighbours.add(from);
        neighbours.add(to);
      }
    }
    for (const [nodeId,node] of nodes) {
      node.classList.toggle('is-selected',active.has(nodeId));
      node.classList.toggle('is-related',neighbours.has(nodeId));
      if (nodeId === id) node.setAttribute('aria-current','true');
      else node.removeAttribute('aria-current');
    }
    if (redrawLocal) drawLocal({reveal:true});
    if (local) {
      for (const item of localSvg.querySelectorAll('[data-groth-node],[data-groth-edge]')) {
        const nodeId = item.dataset.grothNode;
        const selected = (nodeId ?? item.dataset.grothEdge) === id;
        if (nodeId) item.classList.toggle('is-selected',active.has(nodeId));
        if (selected) item.setAttribute('aria-current','true');
        else item.removeAttribute('aria-current');
      }
    }
    nodeSelect.value = local ? localRoot : selectedNode ? id : '';
    const template = templates.get(id);
    passport.replaceChildren(...(template ? [template.content.cloneNode(true)] : []));
    passport.hidden = !template;
    const element = selectedNode || selectedEdge;
    if (element && historyMode === 'push' && location.hash !== '#' + element.id) {
      history.pushState(null,'','#' + element.id);
    }
    if (pan && element && !local) panTo(selectedNode || nodes.get(selectedEdge.dataset.from));
    if (detail) {
      const heading = passport.querySelector('h3');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({preventScroll:true});
        if (passport.getBoundingClientRect().top > window.innerHeight - 80) passport.scrollIntoView({block:'nearest'});
      }
    }
  }

  function restore() {
    const anchor = location.hash.slice(1);
    if (anchor.startsWith('groth-node-') || anchor.startsWith('groth-relation-')) {
      display(anchor.replace(/^groth-(node|relation)-/,''),{pan:true});
      return;
    }
    display(diagram.dataset.grothDefault);
  }

  for (const edge of edges.values()) edge.removeAttribute('hidden');
  controls.hidden = false;
  diagram.addEventListener('click',event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[data-groth-node],a[data-groth-edge],a[data-groth-node-link],a[data-groth-relation-link]');
    if (!link) return;
    event.preventDefault();
    const {grothNode,grothEdge,grothNodeLink,grothRelationLink} = link.dataset;
    const refocus = local && grothNode && localSvg.contains(link) && document.activeElement === link;
    display(grothNode ?? grothEdge ?? grothNodeLink ?? grothRelationLink,{
      pan:Boolean(grothNodeLink),detail:Boolean(grothEdge || grothRelationLink),historyMode:'push',
    });
    if (refocus) localSvg.querySelector('[data-groth-node="' + grothNode + '"]')?.focus({preventScroll:true});
  });
  for (const choice of viewChoices) choice.addEventListener('click',() => selectView(choice.dataset.grothView));
  depthSelect.addEventListener('change',() => drawLocal({reveal:true}));
  for (const filter of kindFilters) filter.addEventListener('change',() => drawLocal());
  topicSelect.addEventListener('change',() => {
    const group = document.getElementById(topicSelect.value);
    if (group) panTo(group);
  });
  function filterNodes() {
    const words = normalized(find.value).split(/\s+/).filter(Boolean);
    const groups = [];
    let count = 0;
    for (const {label,options} of nodeGroups) {
      const matches = options.filter(({text}) => words.every(word => text.includes(word)));
      if (!matches.length) continue;
      count += matches.length;
      const group = document.createElement('optgroup');
      group.label = label;
      group.append(...matches.map(({option}) => option));
      groups.push(group);
    }
    placeholder.textContent = count ? 'Choose a record' : 'No matching concepts';
    nodeSelect.replaceChildren(placeholder,...groups);
    nodeSelect.value = local ? localRoot : nodes.has(currentId) ? currentId : '';
    if (nodeSelect.selectedIndex < 0) nodeSelect.selectedIndex = 0;
    nodeSelect.disabled = !count;
  }
  find.addEventListener('input',filterNodes);
  nodeSelect.addEventListener('change',() => {
    if (nodeSelect.value) display(nodeSelect.value,{pan:true,historyMode:'push'});
  });
  function clear() {
    display('');
    topicSelect.value = find.value = '';
    filterNodes();
    if (/^#groth-(node|relation)-/.test(location.hash)) history.replaceState(null,'','#grothendieck-toposes');
  }
  diagram.querySelector('[data-groth-clear]').addEventListener('click',clear);
  diagram.addEventListener('keydown',event => {
    if (event.key !== 'Escape' || passport.hidden) return;
    const focusInPassport = passport.contains(document.activeElement);
    event.stopPropagation();
    clear();
    if (focusInPassport) nodeSelect.focus();
  });
  addEventListener('hashchange',restore);
  addEventListener('popstate',restore);
  restore();
})();
