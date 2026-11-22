import type { Project, Proposal, Role, Plan, Change, Scenario } from './types.ts';
import { schedule, validDate } from './engine.ts';
export function authorize(role: Role, action: string) {
  const allowed = action === 'decide' ? ['owner', 'lead', 'client'] : action === 'request' ? ['owner', 'lead', 'member', 'client'] : action === 'estimate' ? ['owner', 'lead', 'member'] : ['owner', 'lead'];
  if (!allowed.includes(role)) throw Error('You do not have permission for this action.');
}
export type Command = { action: string; expectedVersion: number; proposalId?: string; proposalRevision?: number; plan?: Plan; change?: Change; scenario?: Scenario; scenarios?: Scenario[]; note?: string; approve?: boolean };
export function transition(input: Project, command: Command, actor: string, now = new Date().toISOString()): Project {
  if (input.version !== command.expectedVersion) throw Error('This project changed in another session. Reload before saving.');
  const p = structuredClone(input); const c = command;
  authorize(p.role, c.action);
  const base = p.baselines.at(-1);
  const proposal = p.proposals.find(x => x.id === c.proposalId);
  if (c.action === 'baseline') {
    if (!c.plan || p.baselines.length) throw Error('Initial baseline already approved. Use a change request for revisions.');
    schedule(c.plan); p.baselines.push({ revision: 1, plan: c.plan, actor, at: now }); p.draft = c.plan;
  } else if (c.action === 'request') {
    if (!base || !c.change) throw Error('Approve a baseline and provide a change request.');
    for (const key of ['id', 'title', 'reason', 'requester', 'assumptions'] as const) if (typeof c.change[key] !== 'string' || !c.change[key].trim() || c.change[key].length > (['reason', 'assumptions'].includes(key) ? 4000 : 200)) throw Error('Complete the change reason, requester and assumptions within the field limits.');
    if (!validDate(c.change.requestedDate) || !['low', 'medium', 'high'].includes(c.change.priority) || !Array.isArray(c.change.edits) || c.change.edits.length > 200 || c.change.edits.some(e => !['add', 'modify', 'remove'].includes(e.kind) || !e.task || typeof e.task.id !== 'string')) throw Error('Invalid change date, priority or scope operations.');
    if (p.changes.some(x => x.id === c.change!.id)) throw Error('Change already exists.');
    p.changes.push(c.change);
  } else if (c.action === 'estimate') {
    if (!base || !c.scenarios?.length || c.scenarios.length > 3 || !p.changes.some(x => x.id === c.proposalId)) throw Error('Choose a change and calculate its scenarios.');
    for (const s of c.scenarios) { if (s.inputRevision !== base.revision) throw Error('Stale baseline calculation.'); s.result = schedule(s.plan); }
    p.scenarios = [...(p.scenarios || []), { changeId: c.proposalId!, items: structuredClone(c.scenarios) }];
  } else if (c.action === 'submit') {
    if (!base || !c.scenario || c.scenario.inputRevision !== base.revision || !c.proposalId || !p.changes.some(x => x.id === c.proposalId)) throw Error('Calculate against the current baseline first.');
    const existing = p.proposals.find(x => x.changeId === c.proposalId);
    if (existing?.status === 'applied') throw Error('This change has already been applied.');
    if (existing?.status === 'approved') throw Error('Withdraw the approved revision before editing.');
    schedule(c.scenario.plan);
    if (existing) { existing.status = 'withdrawn'; }
    const rev = Math.max(0, ...p.proposals.filter(x => x.changeId === c.proposalId).map(x => x.revision)) + 1;
    p.proposals.push({ id: `${c.proposalId}-r${rev}`, changeId: c.proposalId, revision: rev, baseRevision: base.revision, scenario: c.scenario, status: 'pending' });
    p.notifications.push({ id: `${c.proposalId}-r${rev}`, title: `Approval requested: proposal revision ${rev}`, read: false });
  } else if (c.action === 'decide') {
    if (!proposal || proposal.status !== 'pending' || proposal.revision !== c.proposalRevision || proposal.baseRevision !== base?.revision) throw Error('This exact revision is no longer awaiting approval.');
    if (!c.note?.trim()) throw Error('Add a decision note.');
    proposal.status = c.approve ? 'approved' : 'rejected';
    proposal.decision = { actor, at: now, note: c.note, revision: proposal.revision };
    p.notifications.filter(n => n.id === proposal.id).forEach(n => n.read = true);
  } else if (c.action === 'withdraw') {
    if (!proposal || !['pending', 'approved'].includes(proposal.status)) throw Error('Proposal cannot be withdrawn.');
    proposal.status = 'withdrawn';
    p.notifications.filter(n => n.id === proposal.id).forEach(n => n.read = true);
  } else if (c.action === 'apply') {
    if (!proposal || proposal.status !== 'approved' || proposal.decision?.revision !== proposal.revision || proposal.baseRevision !== base?.revision) throw Error('Only an approved proposal against the current baseline can be applied once.');
    if (p.proposals.some(x => x.changeId === proposal.changeId && x.status === 'applied')) throw Error('Change already applied.');
    schedule(proposal.scenario.plan);
    p.baselines.push({ revision: base.revision + 1, plan: structuredClone(proposal.scenario.plan), actor, at: now }); proposal.status = 'applied';
    // Other pending decisions were calculated against an obsolete baseline.
    p.proposals.filter(x => ['pending', 'approved'].includes(x.status)).forEach(x => { x.status = 'withdrawn'; });
    p.notifications.forEach(n => n.read = true);
  } else throw Error('Unknown project command.');
  p.version++;
  p.events.push({ id: `${p.version}-${c.action}`, actor, at: now, action: c.action, detail: c.note || c.change?.title || `Project version ${p.version}` });
  return p;
}
/** Whitelisted client DTO; no resource rates, budgets or labor cost survive. */
export function clientProject(project: Project): object {
  const clean = structuredClone(project);
  const strip = (plan: Plan) => { delete (plan as Partial<Plan>).budgetMinor; for (const r of plan.resources) delete (r as Partial<typeof r>).rateMinor; };
  strip(clean.draft); clean.baselines.forEach(b => strip(b.plan));
  for (const p of clean.proposals) { strip(p.scenario.plan); delete (p.scenario.result as Partial<typeof p.scenario.result>).costMinor; delete (p.scenario.result as Partial<typeof p.scenario.result>).headroomMinor; p.scenario.result.tasks.forEach(t => delete (t as Partial<typeof t>).costMinor); }
  clean.scenarios = [];
  return clean;
}
