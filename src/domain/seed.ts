import type { Project, Plan } from './types.ts';
export function seed(): Project {
  const plan: Plan = { start: '2026-11-23', deadline: '2026-12-11', timezone: 'Asia/Kolkata', currency: 'INR', budgetMinor: 24000000, weekdays: [1, 2, 3, 4, 5], holidays: [], resources: [
    { id: 'design', name: 'Maya · Conversation designer', dailyHours: 6, rateMinor: 150000, availableFrom: '2026-11-23' },
    { id: 'engineer', name: 'Arun · Integration engineer', dailyHours: 4, rateMinor: 200000, availableFrom: '2026-11-23' },
    { id: 'qa', name: 'Leah · QA specialist', dailyHours: 4, rateMinor: 120000, availableFrom: '2026-11-23' }
  ], tasks: [
    { id: 'discovery', title: 'Discovery and requirements', hours: 12, resourceId: 'design', dependencies: [], acceptance: 'Stakeholders sign off the requirements and escalation paths.' },
    { id: 'english', title: 'English conversation flow', hours: 24, resourceId: 'design', dependencies: ['discovery'], acceptance: 'All agreed English intents pass the conversation review.' },
    { id: 'crm', title: 'CRM integration', hours: 24, resourceId: 'engineer', dependencies: ['discovery'], acceptance: 'Create and update a lead without duplicate records.' },
    { id: 'qa', title: 'QA and acceptance testing', hours: 16, resourceId: 'qa', dependencies: ['english', 'crm'], acceptance: 'Acceptance suite passes and client signs off.' },
    { id: 'launch', title: 'Go-live preparation', hours: 8, resourceId: 'engineer', dependencies: ['qa'], acceptance: 'Runbook, monitoring and rollback are verified.' }
  ] };
  return { id: 'demo-project', name: 'Customer Support Agent Rollout', client: 'Northstar Studio · Fictional client', version: 1, role: 'lead', draft: structuredClone(plan), baselines: [{ revision: 1, plan, actor: 'Maya Chen', at: '2026-11-20T10:00:00Z' }], changes: [
    { id: 'hindi', title: 'Add Hindi support', reason: 'Support Hindi-speaking customers in the first launch.', requester: 'Priya · Client lead', requestedDate: '2026-12-11', priority: 'high', assumptions: 'Client supplies approved translations. QA includes bilingual review. No voice support.', edits: [
      { kind: 'add', task: { id: 'hindi-flow', title: 'Hindi conversation flow', hours: 24, resourceId: 'design', dependencies: ['english'], acceptance: 'Approved Hindi intents pass bilingual review.' } },
      { kind: 'modify', task: { ...plan.tasks[3], hours: 24, dependencies: ['english', 'crm', 'hindi-flow'] } }
    ] },
    { id: 'callback', title: 'Add a callback workflow', reason: 'Allow customers to request a follow-up at a preferred time.', requester: 'Priya · Client lead', requestedDate: '2026-12-11', priority: 'medium', assumptions: 'Use an existing callback API; one timezone, no automatic outbound calls.', edits: [
      { kind: 'add', task: { id: 'callback-api', title: 'Callback API workflow', hours: 20, resourceId: 'engineer', dependencies: ['crm'], acceptance: 'Callback request is recorded once with a validated time.' } },
      { kind: 'modify', task: { ...plan.tasks[3], hours: 24, dependencies: ['english', 'crm', 'callback-api'] } }
    ] },
    { id: 'early', title: 'Bring launch forward five working days', reason: 'Align delivery with a client campaign.', requester: 'Priya · Client lead', requestedDate: '2026-12-04', priority: 'high', assumptions: 'No scope reduction or overtime is assumed. The requested date is a constraint to test.', edits: [] }
  ], proposals: [], events: [{ id: 'seed', action: 'baseline', actor: 'Maya Chen', at: '2026-11-20T10:00:00Z', detail: 'Baseline revision 1 approved · 84 person-hours' }], notifications: [] };
}
