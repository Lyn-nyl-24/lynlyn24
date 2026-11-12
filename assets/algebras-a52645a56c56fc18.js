const read = id => document.getElementById(id);
const data = JSON.parse(read('algebra-data').content.textContent);
const controls = document.querySelector('[data-algebra-controls]');
const find = read('algebra-find'), domain = read('algebra-domain'), kind = read('algebra-kind'), focus = read('algebra-focus');
const output = read('algebra-output'), status = read('algebra-status'), more = read('algebra-more');
const definition = read('algebra-definition');
const entries = new Map(data.entries.map(entry => [entry.id,entry]));
const relations = new Map(data.relations.map(row => [row.id,row]));
const lex = input => input.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
const searchable = data.entries.map(row => [row,lex(row.name + ' ' + row.id)]);
let visible = [], shown = 0, active = data.entries.find(row => row.name === 'Integral domain')?.id ??
  data.entries.find(row => data.incidence[row.id]?.length)?.id ?? data.entries[0]?.id;

function options() {
  const terms = lex(find.value.trim()).split(/\s+/).filter(Boolean);
  const rows = searchable.filter(([entry,text]) => (!domain.value || entry.subject === domain.value) &&
    terms.every(term => text.includes(term))).map(([entry]) => entry);
  const kept = rows.some(row => row.id === active);
  if (!kept) active = rows[0]?.id;
  focus.replaceChildren(...rows.map(({id,name}) => new Option(name + ' · ' + id,id,id === active,id === active)));
  focus.disabled = !rows.length;
}
function batch() {
  for (const id of visible.slice(shown,shown + 12)) {
    const fragment = read('algebra-card-' + id).content.cloneNode(true);
    for (const node of fragment.querySelectorAll('.algebra-node')) {
      if (node.hash === '#' + active) node.setAttribute('aria-current','true');
    }
    output.append(fragment);
  }
  shown += 12;
  more.hidden = shown >= visible.length;
}
function show(preferred) {
  const entry = entries.get(active);
  const eligible = (data.incidence[active] ?? []).filter(id => !kind.value || relations.get(id).kind === kind.value);
  visible = preferred ? [preferred,...eligible.filter(id => id !== preferred)] : eligible;
  status.textContent = entry ? entry.name + ' · ' + visible.length + (visible.length === 1 ? ' adjacent relation' : ' adjacent relations') :
    'No matching concepts';
  if (entry && !visible.length) status.textContent += '. Use the shared catalogue for its definition.';
  shown = 0;
  definition.replaceChildren(...(entry ? [read('algebra-node-' + active).content.cloneNode(true)] : []));
  output.replaceChildren();
  batch();
}
function select(id,move) {
  const relation = relations.get(id);
  const entry = entries.get(id);
  if (!relation && !entry) return false;
  if (entry) active = id;
  if (relation) active = relation.endpoints.includes(active) ? active : relation.endpoints[0] ?? active;
  find.value = domain.value = kind.value = '';
  options();
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
for (const input of [find,domain]) input.addEventListener(input === find ? 'input' : 'change',() => {
  options(); show();
});
kind.addEventListener('change',() => show());
focus.addEventListener('change',() => { active = focus.value; setHash(active); show(); });
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
options();
if (!select(location.hash.slice(1),Boolean(location.hash))) show();
