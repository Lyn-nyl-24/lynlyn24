const panel = document.querySelector('[data-stacks-index]');
const query = document.getElementById('stacks-query');
const kind = document.getElementById('stacks-kind');
const chapter = document.getElementById('stacks-chapter');
const coverage = document.getElementById('stacks-coverage');
const status = document.getElementById('stacks-status');
const matches = document.getElementById('stacks-matches');
const more = document.getElementById('stacks-more');
const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
let index;
let requestId = 0;
let shown = 0;
let current = [];

function make(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
function showMore() {
  const batch = current.slice(shown,shown + 50);
  for (const row of batch) {
    const item = make('li','');
    const link = make('a','','stacks-tag');
    link.href = row.chapterKey + '/#tag-' + row.tag;
    link.append(make('code',row.tag));
    const text = make('div','');
    text.append(make('span',row.name,'stacks-name'),make('p',row.kind + ' · ' + row.chapterName +
      (row.linked ? ' · reviewed catalogue link' : ''),'property-context'));
    item.append(link,text);
    matches.append(item);
  }
  shown += batch.length;
  more.hidden = shown >= current.length;
  status.textContent = current.length
    ? 'Showing ' + shown.toLocaleString() + ' of ' + current.length.toLocaleString() + ' matching tags'
    : 'No matching tags';
}
async function search() {
  const request = ++requestId;
  const input = normalize(query.value.trim());
  const terms = input.split(/[\s-]+/).filter(Boolean);
  matches.replaceChildren();
  more.hidden = true;
  if (!terms.length && !kind.value && !chapter.value && !coverage.value) {
    status.textContent = '';
    return;
  }
  if (!index) status.textContent = 'Loading the tag index…';
  try {
    const dataUrl = new URL(panel.dataset.stacksIndex, document.baseURI);
    index ??= import(dataUrl.href).then(({default: groups}) => groups.flatMap(([chapterKey,chapterName,rows]) =>
      rows.map(([tag,kind,name,label,section,linked]) => ({
        chapterKey,chapterName,tag,kind,name,linked,search:normalize([tag,kind,name,label,chapterName,section].join(' ')),
      }))));
    const rows = await index;
    if (request !== requestId) return;
    current = rows.filter(row => (!kind.value || kind.value === row.kind) &&
      (!chapter.value || chapter.value === row.chapterKey) &&
      (!coverage.value || row.linked === (coverage.value === 'linked')) && terms.every(term => row.search.includes(term)));
    const exact = current.findIndex(row => row.tag.toLowerCase() === input);
    if (exact > 0) current.unshift(current.splice(exact,1)[0]);
    shown = 0;
    showMore();
  } catch {
    index = undefined;
    if (request === requestId) status.textContent = 'The search index could not load. Browse the chapter list below.';
  }
}
panel.hidden = false;
query.addEventListener('input',search);
kind.addEventListener('change',search);
chapter.addEventListener('change',search);
coverage.addEventListener('change',search);
more.addEventListener('click',showMore);
const params = new URLSearchParams(location.search);
for (const [key,select] of [['kind',kind],['chapter',chapter],['coverage',coverage]]) {
  if ([...select.options].some(option => option.value === params.get(key))) select.value = params.get(key);
}
if (kind.value || chapter.value || coverage.value) search();
