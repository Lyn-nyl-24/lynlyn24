const read = id => document.getElementById(id);
const data = JSON.parse(read('algebra-data').content.textContent);
const controls = document.querySelector('[data-algebra-controls]');
const find = read('algebra-find'), domain = read('algebra-domain'), kind = read('algebra-kind'), focus = read('algebra-focus');
const output = read('algebra-output'), status = read('algebra-status'), more = read('algebra-more');
const definition = read('algebra-definition');
const entries = new Map(data.entries.map(entry => [entry.id,entry]));
const relations = new Map(data.relations.map(row => [row.id,row]));
const lex = input => input.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
const index = rows => rows.map(row => [row,lex([row.name,row.id,...(row.aliases ?? []),...row.sourceTags].join(' '))]);
const indexedEntries = index(data.entries), indexedRelations = index(data.relations);
let visible = [], shown = 0, active = data.initial ??
  data.entries.find(row => data.incidence[row.id]?.length)?.id ?? data.entries[0]?.id;

function options(preferred) {
  const terms = lex(find.value.trim()).split(/\s+/).filter(Boolean);
  const matches = rows => rows.filter(([row,text]) => (!domain.value || row.subject === domain.value) &&
    terms.every(term => text.includes(term))).map(([row]) => row);
  const concepts = matches(indexedEntries);
  const results = terms.length ? matches(indexedRelations).filter(row => !kind.value || row.style === kind.value) : [];
  const groups = [];
  for (const [label,items] of [['Concepts',concepts],['Relations and witnesses',results]]) {
    if (!items.length) continue;
    const group = document.createElement('optgroup');
    group.label = label;
    group.append(...items.map(({id,name}) => new Option(name + ' · ' + id,id)));
    groups.push(group);
  }
  const previous = preferred ?? focus.value;
  focus.replaceChildren(...groups);
  if ([...focus.options].some(option => option.value === previous)) focus.value = previous;
  focus.disabled = groups.length === 0;
  followFocus();
}
function followFocus() {
  const row = relations.get(focus.value);
  if (row) active = row.endpoints.includes(active) ? active : row.endpoints[0];
  else active = focus.value || undefined;
  return row?.id;
}
let generation = 0;
const pages = new Map();
async function fragment(id) {
  const path = data.pages[id.slice(0,-2)];
  try {
    if (!pages.has(path)) pages.set(path,import(new URL(path,document.baseURI).href));
    const {default:records} = await pages.get(path);
    const template = document.createElement('template');
    template.innerHTML = records[id];
    return template.content;
  } catch {
    pages.delete(path);
    const link = document.createElement('a');
    link.href = data.catalogue + '#' + id;
    link.textContent = 'Open ' + id + ' in the shared catalogue';
    return link;
  }
}
async function batch() {
  const current = generation;
  const ids = visible.slice(shown,shown+12);
  shown += ids.length;
  more.disabled = true;
  const chunks = await Promise.all(ids.map(fragment));
  if (generation !== current) return;
  for (const chunk of chunks) {
    for (const node of chunk.querySelectorAll('.algebra-node')) {
      if (node.hash === '#' + active) node.setAttribute('aria-current','true');
    }
    output.append(chunk);
  }
  more.disabled = false;
  more.hidden = shown >= visible.length;
  output.removeAttribute('aria-busy');
}
function show(preferred) {
  const current = ++generation;
  const entry = entries.get(active);
  const eligible = (data.incidence[active] ?? []).filter(id => !kind.value || relations.get(id).style === kind.value);
  visible = preferred ? [preferred,...eligible.filter(id => id !== preferred)] : eligible;
  status.textContent = entry ? entry.name + ' · ' + visible.length + (visible.length === 1 ? ' adjacent relation' : ' adjacent relations') :
    preferred ? relations.get(preferred).name : 'No matching records';
  shown = 0;
  definition.replaceChildren();
  if (entry) fragment(active).then(node => { if (generation === current) definition.replaceChildren(node); });
  output.replaceChildren();
  output.setAttribute('aria-busy','true');
  more.hidden = true;
  batch();
}
function select(id,move) {
  const relation = relations.get(id);
  const entry = entries.get(id);
  if (!relation && !entry) return false;
  if (entry) active = id;
  if (relation) active = relation.endpoints.includes(active) ? active : relation.endpoints[0] ?? active;
  find.value = domain.value = kind.value = '';
  options(active);
  show(relation?.id);
  if (move) {
    read('algebra-graph').scrollIntoView({block:'start'});
    focus.focus({preventScroll:true});
  }
  return true;
}
function setHash(id) {
  history.replaceState(null,'','#' + id);
}
controls.hidden = false;
for (const input of [find,domain,kind]) input.addEventListener(input === find ? 'input' : 'change',() => {
  options(); show(relations.has(focus.value) ? focus.value : undefined);
});
focus.addEventListener('change',() => { const preferred = followFocus(); setHash(focus.value); show(preferred); });
more.addEventListener('click',batch);
document.querySelector('.algebra-atlas').addEventListener('click',event => {
  const link = event.target.closest('.algebra-node,[data-algebra-focus],.algebra-links a[href^="#"]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const id = link.hash.slice(1);
  if (!select(id,true)) return;
  event.preventDefault();
  setHash(id);
});
addEventListener('hashchange',() => select(location.hash.slice(1),true));
options(active);
if (!select(location.hash.slice(1),Boolean(location.hash))) show();
