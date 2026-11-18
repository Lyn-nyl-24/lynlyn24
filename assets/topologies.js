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
      const map = canvas.querySelector('.morphism-board');
      if (map && !fitted) {
        const anchor = map.querySelector('.topo-node[aria-current]') ?? map.querySelector('.topo-node');
        const bounds = anchor.getBoundingClientRect();
        canvas.scrollLeft += bounds.left + bounds.width/2 - canvas.getBoundingClientRect().left - canvas.clientWidth/2;
      }
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
  const root = document.querySelector('[data-groth-diagram]');
  if (!root) return;
  const form = root.querySelector('.groth-controls');
  const search = form.querySelector('[data-groth-find]');
  const focus = form.querySelector('[data-groth-focus]');
  const depth = form.querySelector('[data-groth-depth]');
  const kind = form.querySelector('[data-groth-kind]');
  const status = form.querySelector('output');
  const groups = [...root.querySelectorAll('.groth-index-group')];
  const nodes = [...root.querySelectorAll('[data-groth-node]')];
  const edges = [...root.querySelectorAll('[data-groth-edge]')].map(el => ({
    el,members:el.dataset.grothMembers.split(' '),kind:el.dataset.grothKind,
  }));
  const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
  const index = new Map([...nodes,...edges.map(e => e.el)].map(el => [el,normalize(el.dataset.grothSearch)]));
  let filtering = false;
  let saved = [];
  function apply() {
    const words = normalize(search.value.trim()).split(/\s+/u).filter(Boolean);
    const active = Boolean(words.length || focus.value || kind.value);
    if (active && !filtering) saved = groups.map(group => group.open);
    const allowed = edges.filter(edge => !kind.value || edge.kind === kind.value);
    let nearby = null;
    if (focus.value) {
      nearby = new Set([focus.value]);
      for (let i=0; i<Number(depth.value); ++i) {
        const frontier = new Set(nearby);
        for (const edge of allowed) if (edge.members.some(id => frontier.has(id))) {
          for (const id of edge.members) nearby.add(id);
        }
      }
    }
    const hits = el => words.every(word => index.get(el).includes(word));
    let nodeCount = 0;
    let edgeCount = 0;
    for (const el of nodes) {
      el.hidden = !hits(el) || (nearby !== null && !nearby.has(el.dataset.grothNode));
      if (!el.hidden) nodeCount++;
    }
    for (const edge of edges) {
      edge.el.hidden = !hits(edge.el) || (kind.value && edge.kind !== kind.value)
        || (nearby !== null && !edge.members.every(id => nearby.has(id)));
      if (!edge.el.hidden) edgeCount++;
    }
    for (const [i,group] of groups.entries()) {
      group.hidden = !group.querySelector('.groth-record:not([hidden])');
      if (active) group.open = !group.hidden;
      else if (filtering) group.open = saved[i];
    }
    depth.disabled = !focus.value;
    status.textContent = active ? nodeCount + ' concepts · ' + edgeCount + ' relations' : '';
    filtering = active;
  }
  function reveal(id) {
    const target = document.getElementById(id);
    if (!target || !root.contains(target)) return;
    const record = target.closest('.groth-record');
    if (target.closest('[hidden]')) { reset(); }
    const group = target.closest('.groth-index-group');
    if (group) group.open = true;
    if (record) record.open = true;
  }
  function reset() {
    search.value = '';
    focus.value = '';
    depth.value = '1';
    kind.value = '';
    apply();
  }
  form.addEventListener('input',apply);
  form.querySelector('[data-groth-reset]').addEventListener('click',reset);
  root.addEventListener('click',event => {
    const a = event.target.closest('a[href^="#groth-"]');
    if (a && !event.defaultPrevented) reveal(a.hash.slice(1));
  });
  addEventListener('hashchange',() => reveal(location.hash.slice(1)));
  form.hidden = false;
  apply();
  reveal(location.hash.slice(1));
})();
