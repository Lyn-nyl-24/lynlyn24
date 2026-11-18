// Propositional unit reasoning for native Pi-Base formulas. Auxiliary
// variables name subformulas and never appear in the public hypotheses.
export function compilePiTheory(properties,theorems,traits = []) {
  const ids = new Map(properties.map((id,i) => [id,i + 1]));
  let next = ids.size;
  const clauses = [], falsifies = new Map(), bySpace = new Map();
  function add(raw,source) {
    const values = [...new Set(raw)];
    if (values.some(lit => values.includes(-lit))) return;
    const i = clauses.push({values,source}) - 1;
    for (const value of values) {
      if (!falsifies.has(-value)) falsifies.set(-value,[]);
      falsifies.get(-value).push(i);
    }
  }
  function subformula(form,source) {
    if (form.property) {
      if (!ids.has(form.property) || typeof form.value !== 'boolean') throw new Error('Invalid Pi-Base atom');
      return ids.get(form.property) * (form.value ? 1 : -1);
    }
    const op = form.and ?? form.or;
    if (!op?.length || (!!form.and === !!form.or)) throw new Error('Invalid Pi-Base connective');
    const args = op.map(inner => subformula(inner,source));
    const variable = ++next;
    if (form.and) {
      for (const lit of args) add([-variable,lit],source);
      add([variable,...args.map(lit => -lit)],source);
    } else {
      for (const lit of args) add([variable,-lit],source);
      add([-variable,...args],source);
    }
    return variable;
  }
  for (const [id,premise,conclusion] of theorems) add([-subformula(premise,id),subformula(conclusion,id)],id);
  const toNumber = (id,value) => {
    if (!ids.has(id) || typeof value !== 'boolean') throw new Error('Unknown point-set property');
    return ids.get(id) * (value ? 1 : -1);
  };
  for (const [space,property,value] of traits) {
    if (!bySpace.has(space)) bySpace.set(space,new Set());
    bySpace.get(space).add(toNumber(property,value));
  }
  function propagate(units) {
    const agenda = [], reasons = new Map();
    const remaining = Uint32Array.from(clauses,clause => clause.values.length);
    let contradiction;
    function force(lit,from) {
      if (reasons.has(lit)) return;
      if (reasons.has(-lit)) { contradiction = {lit,from}; return; }
      agenda.push(lit);
      reasons.set(lit,from);
    }
    for (const lit of units) { force(lit,null); if (contradiction) break; }
    if (!contradiction) for (let i = 0; i < clauses.length; i++) {
      if (remaining[i] === 1) force(clauses[i].values[0],i);
      if (contradiction) break;
    }
    // Falsification counters account for facts when dequeued. They find every
    // unit clause, even when additional facts have already been enqueued.
    const processed = new Set();
    for (let cursor = 0; cursor < agenda.length && !contradiction; cursor++) {
      const lit = agenda[cursor];
      processed.add(lit);
      for (const i of falsifies.get(lit) ?? []) {
        if (--remaining[i] > 1) continue;
        const survivor = clauses[i].values.find(value => !processed.has(-value));
        if (survivor !== undefined) force(survivor,i);
        else { contradiction = {from:i}; }
        if (contradiction) break;
      }
    }
    return {reasons,contradiction};
  }
  function sources({reasons,contradiction},goal) {
    const result = new Set(), seen = new Set();
    const fact = lit => reason(reasons.get(lit),lit);
    function reason(index,except) {
      if (index == null || seen.has(index)) return;
      seen.add(index);
      for (const value of clauses[index].values) if (value !== except) fact(-value);
      result.add(clauses[index].source);
    }
    if (contradiction) {
      reason(contradiction.from,contradiction.lit);
      if (contradiction.lit) fact(-contradiction.lit);
    } else fact(goal);
    return [...result];
  }
  return (hypotheses,conclusion) => {
    const input = hypotheses.map(([id,value]) => toNumber(id,value));
    const goal = toNumber(...conclusion);
    const direct = propagate(input);
    if (direct.contradiction) return {status:'inconsistent',sources:sources(direct)};
    if (direct.reasons.has(goal)) return {status:'proved',sources:sources(direct,goal)};
    const refutation = propagate([...input,-goal]);
    if (refutation.contradiction) return {status:'proved',sources:sources(refutation),method:'refutation'};
    const witnesses = [...bySpace].filter(([,facts]) => facts.has(-goal) && input.every(fact => facts.has(fact))).map(([space]) => space);
    return {status:witnesses.length ? 'counterexample' : 'unknown',witnesses};
  };
}

const pi = document.querySelector('[data-pi-controls]');
if (pi) {
  const input = document.getElementById('pi-query');
  const linked = document.getElementById('pi-linked');
  const status = document.getElementById('pi-status');
  const norm = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
  const rows = [...document.querySelectorAll('[data-pi-row]')].map(row => [row,norm(row.dataset.piRow)]);
  function filter() {
    const terms = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const [row,text] of rows) {
      row.hidden = (linked.value && row.dataset.piCrosswalk !== linked.value) || !terms.every(term => text.includes(term));
      if (!row.hidden) visible++;
    }
    status.textContent = visible.toLocaleString() + ' matching records';
  }
  function showTarget() {
    const id = location.hash.slice(1);
    const target = /^(?:[PTS]\d{6}|S\d{6}-P\d{6})$/.test(id) && document.getElementById(id);
    const record = target && target.closest('[data-pi-row]');
    if (!record) return;
    if (record.hidden) { input.value = ''; linked.value = ''; filter(); }
    record.open = true;
    if (target !== record) target.querySelector('details').open = true;
    target.scrollIntoView({block:'nearest'});
  }
  pi.hidden = false;
  input.addEventListener('input',filter);
  linked.addEventListener('change',filter);
  addEventListener('hashchange',showTarget);
  filter();
  showTarget();
}

const chapter = document.querySelector('[data-stacks-citations]');
if (chapter) {
  let shared;
  function chapterData() {
    return shared ??= fetch(new URL(chapter.dataset.stacksCitations,document.baseURI)).then(response => {
      if (!response.ok) throw new Error('Could not load the chapter');
      return response.json();
    }).catch(error => { shared = undefined; throw error; });
  }
  const contextNames = [[1,'Statement'],[2,'Proof'],[4,'Chapter or section prose']];
  const make = (tag,text) => Object.assign(document.createElement(tag),{textContent:text});
  async function populate(details) {
    if (!details.open || details.dataset.ready) return;
    const content = details.querySelector('.stacks-citation-content');
    content.textContent = 'Loading references…';
    try {
      const {rows,locations} = await chapterData();
      const [outgoing,incoming] = rows[details.dataset.stacksCite] ?? [[],[]];
      content.replaceChildren();
      for (const [label,edges] of [['Cites',outgoing],['Cited by',incoming]]) {
        if (!edges.length) continue;
        content.append(make('strong',label));
        const list = make('ul','');
        content.append(list);
        let shown = 0;
        const more = make('button','Show more');
        more.type = 'button';
        function batch() {
          for (const [tag,bits] of edges.slice(shown,shown + 60)) {
            const item = make('li','');
            const link = make('a',tag);
            link.href = '../' + locations[tag] + '/#tag-' + tag;
            item.append(link,make('small',contextNames.filter(([bit]) => bits & bit).map(([,name]) => name).join(' · ')));
            list.append(item);
          }
          shown += 60;
          more.hidden = shown >= edges.length;
        }
        more.addEventListener('click',batch);
        content.append(more);
        batch();
      }
      details.dataset.ready = 'true';
    } catch {
      shared = undefined;
      content.textContent = 'References could not load. Reopen to retry or use the chapter JSON.';
    }
  }
  chapter.addEventListener('toggle',event => {
    if (event.target.matches('[data-stacks-cite]')) populate(event.target);
  },true);

  // Keep the whole statement visible when locating an item: hypotheses may
  // occur after a list, or apply only to one case within the list.
  const reader = chapter.querySelector('.atlas-statement-reader');
  const source = reader.querySelector('[data-reader-source]');
  const passage = reader.querySelector('[data-reader-passage]');
  const equivalence = reader.querySelector('[data-reader-equivalence]');
  const status = reader.querySelector('[data-reader-status]');
  const link = (name,url) => Object.assign(make('a',name),{href:url});
  let chapterText, request = 0;
  reader.querySelector('[data-reader-close]').addEventListener('click',() => reader.close());
  reader.addEventListener('close',() => { request++; });
  passage.addEventListener('change',() => {
    const [first,last] = passage.value.split(':').map(Number);
    for (const button of equivalence.querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.value === passage.value));
    let firstLine;
    for (const line of source.children) {
      const number = Number(line.dataset.line);
      line.classList.toggle('selected',number >= first && number <= last);
      if (number === first) firstLine = line;
    }
    (firstLine ?? source.firstElementChild)?.scrollIntoView({block:'nearest'});
  });
  chapter.addEventListener('click',async event => {
    const trigger = event.target.closest('[data-read-tag]');
    if (!trigger || !reader.showModal || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const tag = trigger.dataset.readTag, current = ++request;
    reader.querySelector('h2').textContent = 'Stacks ' + tag;
    reader.querySelector('[data-reader-meta]').textContent = trigger.closest('li').querySelector('.stacks-name').textContent;
    const links = reader.querySelector('[data-reader-links]');
    links.replaceChildren(link('Typeset original',trigger.href),link('Pinned TeX',trigger.previousElementSibling.href));
    const label = passage.closest('label');
    label.hidden = true;
    equivalence.hidden = true;
    source.replaceChildren();
    status.textContent = 'Loading the original statement…';
    reader.showModal();
    try {
      const {file,revision,spans,equivalences} = await chapterData();
      const [first,last,...lists] = spans[tag];
      chapterText ??= fetch('https://raw.githubusercontent.com/stacks/stacks-project/' + revision + '/' + file)
        .then(response => { if (!response.ok) throw new Error('Source unavailable'); return response.text(); })
        .then(text => text.split(/\r?\n/)).catch(error => { chapterText = undefined; throw error; });
      const lines = await chapterText;
      if (current !== request || !reader.open) return;
      if (last > lines.length) throw new Error('Missing source lines');
      passage.replaceChildren(new Option('Whole statement','0:0'));
      lists.forEach((items,g) => items.forEach(([a,b],i) => passage.add(new Option(
        (lists.length > 1 ? 'List ' + (g+1) + ' · ' : '') + 'Item ' + (i+1) + ' · lines ' + a + '–' + b,a + ':' + b))));
      label.hidden = passage.length === 1;
      if (equivalences[tag]) {
        const nav = equivalence.querySelector('nav');
        nav.replaceChildren();
        for (const [i,[a,b]] of lists[0].entries()) {
          if (i) nav.append(make('span','⇔'));
          const button = make('button','Condition ' + (i+1));
          button.type = 'button';
          button.value = a + ':' + b;
          button.setAttribute('aria-pressed','false');
          button.addEventListener('click',() => {
            passage.value = button.value;
            passage.dispatchEvent(new Event('change'));
          });
          nav.append(button);
        }
        equivalence.hidden = false;
      }
      const fragment = document.createDocumentFragment();
      for (let n=first; n <= last; n++) {
        const line = make('span',lines[n-1] || ' ');
        line.dataset.line = n;
        fragment.append(line);
      }
      source.append(fragment);
      status.textContent = 'The Stacks Project · ' + file + ' · lines ' + first + '–' + last + ' · ' + revision.slice(0,12);
    } catch {
      if (current === request) status.textContent = 'The source could not load. Use the pinned TeX link above or reopen to retry.';
    }
  });
}

const piCheck = document.getElementById('pi-logic');
if (piCheck) {
  piCheck.hidden = false;
  const find = id => document.getElementById(id);
  const premise = find('pi-premise'), goal = find('pi-goal'), assumptions = find('pi-assumptions');
  const outcome = find('pi-proof'), selected = new Map();
  const {properties,rules,facts} = JSON.parse(find('pi-theory').content.textContent);
  const names = new Map(properties);
  const ordered = [...properties].sort((a,b) => a[1].localeCompare(b[1]));
  for (const select of [premise,goal]) {
    select.replaceChildren(...ordered.map(([id,name]) => new Option(name + ' · ' + id,id)));
  }
  if (names.has('P000075') && names.has('P000073')) { premise.value = 'P000075'; goal.value = 'P000073'; }
  function renderAssumptions() {
    assumptions.replaceChildren(...[...selected].map(([key,[id,value]]) => {
      const row = document.createElement('li'), remove = document.createElement('button');
      const text = (value ? '' : '¬ ') + names.get(id);
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label','Remove ' + text);
      remove.addEventListener('click',() => { selected.delete(key); renderAssumptions(); premise.focus(); });
      row.append(text,remove);
      return row;
    }));
    outcome.replaceChildren();
  }
  find('pi-add').addEventListener('click',() => {
    const value = find('pi-premise-value').value === 'yes';
    selected.set(premise.value + value,[premise.value,value]);
    renderAssumptions();
  });
  let check;
  find('pi-run').addEventListener('click',() => {
    check ??= compilePiTheory(properties.map(([id]) => id),rules,facts);
    const answer = check([...selected.values()],[goal.value,find('pi-goal-value').value === 'yes']);
    const labels = {proved:'Follows from the entered hypotheses in Pi-Base',
      inconsistent:'The entered hypotheses conflict in Pi-Base',
      counterexample:'A space with the required explicit traits refutes this implication',
      unknown:'Unresolved with the encoded theory and recorded traits'};
    const p = document.createElement('p');
    p.textContent = labels[answer.status] + (answer.method === 'refutation' ? ' (by unit refutation).' : '.');
    outcome.replaceChildren(p);
    const references = answer.sources ?? answer.witnesses?.slice(0,20) ?? [];
    if (!references.length) return;
    const list = document.createElement('ul');
    for (const id of references) {
      const link = document.createElement('a'), li = document.createElement('li');
      link.href = id.startsWith('T') ? '#' + id : '../spaces/#' + id;
      link.textContent = (id.startsWith('T') ? 'Pi-Base theorem ' : 'Pi-Base space ') + id;
      li.append(link);
      list.append(li);
    }
    outcome.append(list);
  });
}
