import { createDeduction, opposite } from './property-deduction-5318cdd3b02bb71f.js';

const byId = id => document.getElementById(id);
const data = JSON.parse(byId('property-data').content.textContent);
const entries = new Map(data.entries.map(entry => [entry.id,entry]));
const records = [...document.querySelectorAll('[data-record]')];
const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replaceAll('π','pi');
const searchable = records.map(record => [record,normalize(record.dataset.search),
  new Set(record.dataset.externalIds.toLowerCase().split(' ')),new Set(record.dataset.stacksTags.toLowerCase().split(' '))]);
const search = byId('database-query'), kind = byId('database-kind'), topic = byId('database-topic'), role = byId('database-role');
const discipline = byId('database-discipline');
const initial = new URLSearchParams(location.search);
if (['algebras','topologies'].includes(initial.get('discipline'))) discipline.value = initial.get('discipline');
const filterPanel = search.closest('.property-filters');
const resultCount = byId('database-results');
const clearFilters = byId('database-clear');
const clusters = [...document.querySelectorAll('.property-cluster')];
const sections = [...document.querySelectorAll('.property-group')];

function filter() {
  const external = [];
  const stacks = [];
  const query = normalize(search.value).replace(/\bstacks[:\s]+([0-9][a-z0-9]{3})\b/g,(_,id) => {
    stacks.push(id);
    return ' ';
  }).replace(/\bpi[- ]?base[:\s]+([pts]\d{6})\b/g,(_,id) => {
    external.push(id);
    return ' ';
  });
  const terms = query.trim().split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const [record,index,externalIds,stacksTags] of searchable) {
    record.hidden = (kind.value !== '' && kind.value !== record.dataset.kind)
      || (topic.value !== '' && topic.value !== record.dataset.topic && topic.value !== record.dataset.subject)
      || (role.value !== '' && role.value !== record.dataset.role)
      || (discipline.value !== '' && discipline.value !== record.dataset.discipline)
      || !terms.every(term => index.includes(term)) || !external.every(id => externalIds.has(id)) ||
      !stacks.every(id => stacksTags.has(id));
    if (!record.hidden) visible++;
  }
  for (const cluster of clusters) cluster.hidden = !cluster.querySelector('[data-record]:not([hidden])');
  for (const section of sections) section.hidden = !section.querySelector('.property-cluster:not([hidden])');
  resultCount.textContent = visible === 0 ? 'No matching records.' : visible + ' matching records';
  clearFilters.hidden = !(search.value || kind.value || topic.value || role.value || discipline.value);
}
function revealHash() {
  const id = location.hash.slice(1);
  if (id === 'database-check') byId(id).open = true;
  if (!/^[PGTX]\d{6}$/.test(id)) return;
  const record = byId(id);
  if (!record) return;
  if (record.hidden) {
    search.value = kind.value = topic.value = role.value = discipline.value = '';
    filter();
  }
  record.open = true;
  requestAnimationFrame(() => record.scrollIntoView({block:'start'}));
}
filterPanel.hidden = false;
search.addEventListener('input',filter);
kind.addEventListener('change',filter);
topic.addEventListener('change',filter);
role.addEventListener('change',filter);
discipline.addEventListener('change',filter);
clearFilters.addEventListener('click', () => {
  search.value = kind.value = topic.value = role.value = discipline.value = '';
  filter();
  search.focus();
});
addEventListener('hashchange',revealHash);
document.addEventListener('click',event => {
  const link = event.target.closest('a[href^="#"]');
  if (link && link.hash === location.hash) revealHash();
});
filter();
revealHash();

const deduction = createDeduction(data.theorems,data.examples,data.entries);
const domain = byId('database-domain'), premise = byId('database-premise'), goal = byId('database-goal');
if ([...domain.options].some(option => option.value === initial.get('domain'))) domain.value = initial.get('domain');
const premiseValue = byId('database-premise-value'), goalValue = byId('database-goal-value');
const add = byId('database-add'), check = byId('database-run');
const hypotheses = byId('database-hypotheses'), output = byId('database-proof');
const assumptions = new Set();
const make = (tag,text) => Object.assign(document.createElement(tag),text ? {textContent:text} : {});
function anchor(literal,text) {
  const negative = literal.startsWith('~'), id = negative ? opposite(literal) : literal;
  return Object.assign(make('a',text ?? (negative ? '¬ ' : '') + (entries.get(id)?.name ?? id)),{href:'#' + id});
}
function setOptions(select,items) {
  select.replaceChildren(...items.map(({id,name}) => new Option(name + ' · ' + id,id)));
}
function updateAssumptions() {
  const previous = premise.value;
  for (const option of premise.options) option.disabled = assumptions.has(premiseValue.value + option.value);
  if (!previous || assumptions.has(premiseValue.value + previous)) premise.value = [...premise.options].find(o => !o.disabled)?.value ?? '';
  add.disabled = !premise.value;
  check.disabled = !assumptions.size;
  output.replaceChildren();
  hypotheses.replaceChildren(...[...assumptions].map(id => {
    const li = make('li'), remove = make('button','×');
    remove.type = 'button';
    remove.setAttribute('aria-label','Remove ' + anchor(id).textContent);
    remove.addEventListener('click',() => { assumptions.delete(id); updateAssumptions(); premise.focus(); });
    li.append(anchor(id),remove);
    return li;
  }));
}
function selectDomain() {
  assumptions.clear();
  premiseValue.value = goalValue.value = '';
  const choices = data.entries.filter(entry => entry.subject === domain.value && entry.executable)
    .sort((a,b) => a.name.localeCompare(b.name));
  setOptions(premise,choices);
  setOptions(goal,choices);
  updateAssumptions();
}
domain.addEventListener('change',selectDomain);
premiseValue.addEventListener('change',updateAssumptions);
for (const select of [goal,goalValue]) select.addEventListener('change',() => output.replaceChildren());
add.addEventListener('click',() => {
  if (!premise.value) return;
  assumptions.add(premiseValue.value + premise.value);
  updateAssumptions();
  if (add.disabled) goal.focus();
});
function appendPremises(element,premises) {
  premises.forEach((id,i) => { if (i) element.append(' + '); element.append(anchor(id)); });
}
function proofTrace(result) {
  const trace = [];
  if (result.temporary) {
    const assumption = make('p');
    assumption.append('Temporary hypothesis for refutation: ',anchor(result.temporary),'.');
    trace.push(assumption);
  }
  const proof = make('ol');
  for (const step of result.steps ?? []) {
    const li = make('li');
    appendPremises(li,step.premises);
    li.append(' → ',anchor(step.conclusion),' · ',anchor(step.theorem));
    proof.append(li);
  }
  if (result.conflict) {
    const li = make('li');
    appendPremises(li,result.conflict.premises);
    li.append(' → contradiction');
    if (result.conflict.theorem) li.append(' · ',anchor(result.conflict.theorem));
    proof.append(li);
  }
  if (proof.childElementCount) trace.push(proof);
  return trace;
}
check.addEventListener('click',() => {
  const target = goalValue.value + goal.value;
  const result = deduction.query([...assumptions],target);
  const summary = make('p');
  if (result.status === 'proved') {
    summary.append(make('strong',result.temporary ? 'Proved by refutation. ' : 'Proved. '),anchor(target),
      result.steps.length || result.conflict ? ' follows from the selected hypotheses.' : ' is one of the hypotheses.');
    output.replaceChildren(summary,...proofTrace(result));
  } else if (result.status === 'counterexample') {
    const example = data.examples.find(example => example.id === result.example);
    summary.append(make('strong','Counterexample. '),anchor(example.id,example.name),
      ' satisfies the selected hypotheses and has the opposite of the proposed conclusion: ',anchor(opposite(target)),'.');
    output.replaceChildren(summary);
  } else if (result.status === 'inconsistent') {
    summary.append(make('strong','Incompatible hypotheses. '),'The selected hypotheses contradict a recorded rule or each other.');
    output.replaceChildren(summary,...proofTrace(result));
  } else if (result.status === 'opposite') {
    summary.append(make('strong','The opposite follows. '),anchor(opposite(target)),' follows from the selected hypotheses.');
    output.replaceChildren(summary,...proofTrace(result));
  } else {
    summary.append(make('strong','Unknown in this catalogue. '),'The stored rules and examples do not decide this query.');
    output.replaceChildren(summary);
  }
});
byId('database-domain').closest('.property-check-controls').hidden = false;
selectDomain();
