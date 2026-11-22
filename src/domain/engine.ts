import type { Plan, Schedule, ScopeEdit, Scenario, Resource } from './types.ts';

const iso = /^\d{4}-\d{2}-\d{2}$/;
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && iso.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function nextDate(date: string, n = 1): string {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function working(plan: Plan, date: string): boolean {
  return plan.weekdays.includes(new Date(date + 'T00:00:00Z').getUTCDay()) && !plan.holidays.includes(date);
}
export function shiftWorking(plan: Plan, date: string, count: number): string {
  let value = date;
  for (let i = 0; i < Math.abs(count);) { value = nextDate(value, Math.sign(count)); if (working(plan, value)) i++; }
  return value;
}
export function validatePlan(plan: Plan): void {
  if (!plan || !validDate(plan.start) || !validDate(plan.deadline)) throw Error('Enter valid project dates.');
  if (plan.deadline < plan.start) throw Error('Deadline must be on or after project start.');
  if (!['INR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'SGD'].includes(plan.currency)) throw Error('Supported currencies: INR, USD, GBP, EUR, AUD, CAD and SGD (two-decimal minor units).');
  try { new Intl.DateTimeFormat('en', { timeZone: plan.timezone }).format(); } catch { throw Error('Choose a valid IANA timezone.'); }
  if (!Number.isSafeInteger(plan.budgetMinor) || plan.budgetMinor < 0 || plan.budgetMinor > 1e12) throw Error('Budget must be a nonnegative integer in minor units.');
  if (!Array.isArray(plan.weekdays) || !plan.weekdays.length || plan.weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw Error('Select working weekdays.');
  if (!Array.isArray(plan.holidays) || plan.holidays.some(d => !validDate(d))) throw Error('Invalid holiday date.');
  if (!Array.isArray(plan.tasks) || plan.tasks.length > 200 || !Array.isArray(plan.resources) || plan.resources.length > 50) throw Error('Plan exceeds MVP limits.');
  const resources = new Map(plan.resources.map(r => [r.id, r]));
  if (resources.size !== plan.resources.length) throw Error('Duplicate resource identifiers.');
  for (const r of plan.resources) {
    if (!r.id || !r.name || !validDate(r.availableFrom) || !Number.isFinite(r.dailyHours) || r.dailyHours < 0 || r.dailyHours > 24 || !Number.isInteger(r.dailyHours * 4) || !Number.isSafeInteger(r.rateMinor) || r.rateMinor < 0 || r.rateMinor > 1e8) throw Error('Invalid resource: use quarter-hour availability and integer rates.');
  }
  const tasks = new Map(plan.tasks.map(t => [t.id, t]));
  if (tasks.size !== plan.tasks.length) throw Error('Duplicate deliverable identifiers.');
  const visiting = new Set<string>(), done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw Error('Dependency cycle detected.');
    if (done.has(id)) return;
    const task = tasks.get(id);
    if (!task) throw Error(`Missing dependency ${id}. Rewire dependent work before removing it.`);
    visiting.add(id);
    if (!Array.isArray(task.dependencies)) throw Error('Dependencies must be a list.');
    task.dependencies.forEach(visit); visiting.delete(id); done.add(id);
  }
  for (const t of plan.tasks) {
    if (!t.id || !t.title?.trim() || !t.acceptance?.trim()) throw Error('Every deliverable needs a title and acceptance criteria.');
    if (!Number.isFinite(t.hours) || t.hours <= 0 || t.hours > 10000 || !Number.isInteger(t.hours * 4)) throw Error('Each estimate must be positive, in quarter hours.');
    if (!resources.has(t.resourceId)) throw Error(`Assign a resource to ${t.title}.`);
    visit(t.id);
  }
}

/** Stable serial schedule generation. Finish-to-start dependencies begin next working day.
 * One assignee per task. Quarter-hour effort; whole-day dependency boundaries. No optimality claim. */
export function schedule(plan: Plan): Schedule {
  validatePlan(plan);
  const result: Schedule = { effort: 0, costMinor: 0, headroomMinor: 0, finish: plan.start, feasible: true, warnings: [], tasks: [], utilization: [] };
  const remaining = new Map(plan.tasks.map(t => [t.id, t]));
  const scheduled = new Map<string, string>(); const ledger = new Map<string, number>();
  const horizon = nextDate(plan.start, 3650);
  while (remaining.size) {
    const t = [...remaining.values()].find(t => t.dependencies.every(d => scheduled.has(d)));
    if (!t) throw Error('Dependencies could not be scheduled.');
    const r = plan.resources.find(r => r.id === t.resourceId)!;
    if (!r.dailyHours) throw Error(`${r.name} has zero project capacity.`);
    let date = [plan.start, r.availableFrom, ...t.dependencies.map(d => nextDate(scheduled.get(d)!))].sort().at(-1)!;
    let left = t.hours; const days: { date: string; hours: number }[] = []; let contended = false;
    while (left > 0) {
      if (date > horizon) throw Error('Schedule exceeds the ten-year planning horizon.');
      if (working(plan, date)) {
        const key = `${r.id}:${date}`; const used = ledger.get(key) || 0;
        const take = Math.min(left, r.dailyHours - used);
        if (used) contended = true;
        if (take > 0) { days.push({ date, hours: take }); ledger.set(key, used + take); left -= take; }
      }
      if (left > 0) date = nextDate(date);
    }
    // Round HALF UP to the currency's minor unit, once per task using integer quarter-hours.
    const costMinor = Number((BigInt(t.hours * 4) * BigInt(r.rateMinor) + 2n) / 4n);
    if (contended) result.warnings.push(`${t.title}: shared capacity with other work; no overbooking permitted.`);
    result.tasks.push({ id: t.id, start: days[0].date, finish: date, hours: t.hours, costMinor, days });
    result.effort += t.hours; result.costMinor += costMinor;
    result.finish = result.finish > date ? result.finish : date;
    scheduled.set(t.id, date); remaining.delete(t.id);
  }
  result.feasible = result.finish <= plan.deadline;
  if (!result.feasible) result.warnings.push(`Deadline infeasible: forecast ${result.finish} exceeds ${plan.deadline}.`);
  result.headroomMinor = plan.budgetMinor - result.costMinor;
  if (result.headroomMinor < 0) result.warnings.push('Estimated labor cost exceeds the project budget.');
  for (const r of plan.resources) {
    let available = 0;
    for (let date = plan.start; date <= result.finish; date = nextDate(date)) if (date >= r.availableFrom && working(plan, date)) available += r.dailyHours;
    result.utilization.push({ id: r.id, hours: plan.tasks.filter(t => t.resourceId === r.id).reduce((s, t) => s + t.hours, 0), available });
  }
  return result;
}
export function applyEdits(plan: Plan, edits: ScopeEdit[]): Plan {
  const copy = structuredClone(plan);
  for (const e of edits) {
    const i = copy.tasks.findIndex(t => t.id === e.task.id);
    if (e.kind === 'add') { if (i >= 0) throw Error('Added deliverable already exists.'); copy.tasks.push(structuredClone(e.task)); }
    else { if (i < 0) throw Error('Changed deliverable does not exist.'); if (e.kind === 'remove') copy.tasks.splice(i, 1); else copy.tasks[i] = structuredClone(e.task); }
  }
  validatePlan(copy); return copy;
}
export function compare(plan: Plan, edits: ScopeEdit[], revision: number, deferrals: string[], extra: Resource, onboarding: number): Scenario[] {
  const revised = applyEdits(plan, edits);
  const assumptions = ['Quarter-hour effort; finish-to-start dependencies at day boundaries.', 'All assigned hours are project availability, not total employment hours.', 'Forecast starts at project start; actual progress and external project contention are not tracked.'];
  const make = (id: string, title: string, tradeoff: string, p: Plan): Scenario => ({ id, title, tradeoff, plan: p, result: schedule(p), inputRevision: revision, assumptions });
  const deferred = structuredClone(revised);
  deferred.tasks = deferred.tasks.filter(t => !deferrals.includes(t.id));
  // Never silently remove dependency links; user must explicitly choose dependent work too.
  const added = structuredClone(revised);
  if (!Number.isFinite(onboarding) || onboarding < 0 || !Number.isInteger(onboarding * 4)) throw Error('Onboarding must be nonnegative quarter hours.');
  if (added.resources.some(r => r.id === extra.id)) throw Error('Additional capacity needs a unique resource.');
  added.resources.push(structuredClone(extra));
  const candidates = added.tasks.filter(t => edits.some(e => e.kind === 'add' && e.task.id === t.id));
  if (onboarding > 0) {
    added.tasks.push({ id: 'onboarding-' + extra.id, title: 'Additional resource onboarding', hours: onboarding, resourceId: extra.id, dependencies: [], acceptance: 'Access and project context confirmed.' });
  }
  for (const task of candidates) { task.resourceId = extra.id; if (onboarding) task.dependencies.push('onboarding-' + extra.id); }
  return [make('extend', 'Accept & extend', 'Retain all proposed scope; accept the calculated delivery date.', revised), make('defer', 'Trade scope for time', deferrals.length ? `Defer ${deferrals.length} selected deliverable(s). Deadline feasibility is calculated.` : 'No scope deferred yet. Select work to remove before claiming a deadline is protected.', deferred), make('capacity', 'Add capacity', `${extra.name}: ${extra.dailyHours}h/day from ${extra.availableFrom}; ${onboarding}h onboarding. Only added tasks are reassigned; tasks are not split.`, added)];
}
