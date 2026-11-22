import type { Project } from './domain/types.ts';
import type { Command } from './domain/workflow.ts';
import { transition } from './domain/workflow.ts';
import { seed } from './domain/seed.ts';
const KEY = 'scopeshift-demo-v1';
export const demo = {
  load(): Project {
    try { const raw = localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw); if (p.id === 'demo-project' && Array.isArray(p.baselines)) return p; } } catch { /* Corrupted or blocked browser storage falls back to isolated memory. */ }
    return seed();
  },
  save(p: Project, command: Command): Project {
    const current = this.load();
    if (current.version !== p.version) throw Error('Demo changed in another tab. Reload before saving.');
    const next = transition(p, command, p.role === 'client' ? 'Priya · Demo client' : 'Maya · Demo delivery lead');
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { throw Error('Browser storage is unavailable. Enable local storage to save the demo.'); }
    return next;
  },
  reset(): Project { localStorage.removeItem(KEY); return seed(); }
};
