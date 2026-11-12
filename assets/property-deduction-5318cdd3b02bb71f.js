/**
 * A literal is an entry ID, or "~" followed by that ID. A missing literal is unknown.
 * @typedef {{theorem:string, premises:string[]}} Evidence
 * @typedef {{theorem?:string, premises:string[]}} Conflict
 * @typedef {{facts:Map<string,Evidence|null>, conflict?:Conflict}} State
 */
export const opposite = literal => literal.startsWith('~') ? literal.slice(1) : '~' + literal;
const unsigned = literal => literal.startsWith('~') ? literal.slice(1) : literal;

/**
 * Compile each conjunction-to-conjunction direction as one Horn clause per conclusion.
 * Store posting lists keyed by the literal that would falsify a clause member.
 */
export function createDeduction(theorems, examples = [], entries = []) {
  const domains = new Map(entries.map(({id,subject}) => [id,subject]));
  const clauses = [], whenFalse = new Map(), units = [];
  const add = (id,premises,results) => {
    for (const conclusion of results) {
      if (premises.includes(conclusion)) continue; // a tautological component
      const literals = [...premises.map(opposite),conclusion];
      const index = clauses.push({id,literals}) - 1;
      if (literals.length === 1) units.push(index);
      for (const literal of literals) {
        const falsifier = opposite(literal);
        if (!whenFalse.has(falsifier)) whenFalse.set(falsifier,[]);
        whenFalse.get(falsifier).push(index);
      }
    }
  };
  for (const {id, kind, requires, concludes} of theorems) {
    if (kind !== 'implies' && kind !== 'equivalence') continue;
    add(id,requires,concludes);
    if (kind === 'equivalence') add(id,concludes,requires);
  }

  /** @returns {State} */
  function saturate(assumptions) {
    const queue = [...new Set(assumptions)];
    const facts = new Map(queue.map(id => [id,null]));
    for (const id of queue) {
      const negated = opposite(id);
      if (facts.has(negated)) return {facts,conflict:{premises:[id,negated]}};
    }
    const remaining = new Uint32Array(clauses.map(clause => clause.literals.length));
    // Only processed facts have been counted against clause members.
    const processed = new Set();
    const inspect = (index) => {
      const {id,literals} = clauses[index];
      const premises = [], candidates = [];
      for (const literal of literals) {
        const negated = opposite(literal);
        if (processed.has(negated)) premises.push(negated);
        else candidates.push(literal);
      }
      if (!candidates.length) return {theorem:id,premises};
      const [literal] = candidates;
      if (facts.has(literal)) return;
      const negated = opposite(literal);
      if (facts.has(negated)) return {theorem:id,premises:[...premises,negated]};
      facts.set(literal,{theorem:id,premises});
      queue.push(literal);
    };
    for (const index of units) {
      const conflict = inspect(index);
      if (conflict) return {facts,conflict};
    }
    for (const literal of queue) {
      processed.add(literal);
      for (const index of whenFalse.get(literal) ?? []) {
        if (--remaining[index] > 1) continue;
        const conflict = inspect(index);
        if (conflict) return {facts,conflict};
      }
    }
    return {facts};
  }

  function explain(facts,roots) {
    const needed = new Set(), pending = [...roots];
    for (const literal of pending) {
      if (needed.has(literal)) continue;
      needed.add(literal);
      const step = facts.get(literal);
      if (step) pending.push(...step.premises);
    }
    const steps = [], givens = [];
    for (const [literal,step] of facts) {
      if (!needed.has(literal)) continue;
      if (step) steps.push({conclusion:literal,...step});
      else givens.push(literal);
    }
    return {steps,givens};
  }

  const witnessIndex = new Map(), witnessConflicts = [];
  for (const example of examples) {
    if (!example.has.length && !example.lacks.length) continue;
    const {facts,conflict} = saturate([...example.has,...example.lacks.map(opposite)]);
    if (conflict) { witnessConflicts.push(example.id); continue; }
    for (const literal of facts.keys()) {
      if (!witnessIndex.has(literal)) witnessIndex.set(literal,[]);
      witnessIndex.get(literal).push({example,facts});
    }
  }

  function query(assumptions, goal) {
    if (domains.size) {
      const domain = domains.get(unsigned(goal));
      if (!domain || assumptions.some(id => domains.get(unsigned(id)) !== domain)) return {status:'invalid'};
    }
    const {facts,conflict} = saturate(assumptions);
    if (conflict) return {status:'inconsistent',...explain(facts,conflict.premises),conflict};
    if (facts.has(goal)) return {status:'proved', method:'direct', ...explain(facts,[goal])};
    const negated = opposite(goal);
    const found = witnessIndex.get(negated)?.find(({facts:known}) => assumptions.every(id => known.has(id)));
    if (found) return {status:'counterexample',example:found.example.id};
    if (facts.has(negated)) return {status:'opposite',...explain(facts,[negated])};

    // Refute the opposite of the goal. Unit refutation is complete for Horn CNF
    // with signed unit facts; the resulting certificate marks the extra hypothesis.
    const trial = saturate([...assumptions,negated]);
    if (trial.conflict) return {
      status:'proved', method:'refutation', temporary:negated,
      ...explain(trial.facts,trial.conflict.premises), conflict:trial.conflict,
    };
    return {status:'unknown'};
  }
  return { saturate, query, witnessConflicts };
}
