import { seed } from '../src/domain/seed.ts';
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
let cookie = '';
async function post(url: string, payload: unknown) {
  const response = await fetch(origin + url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(payload) });
  const cookies = response.headers.getSetCookie(); if (cookies.length) cookie = cookies.map(c => c.split(';')[0]).join('; ');
  const data = await response.json(); if (!response.ok) throw Error(data.error || 'Seed failed.'); return data;
}
if (!process.env.SEED_EMAIL || !process.env.SEED_PASSWORD) throw Error('Set SEED_EMAIL and SEED_PASSWORD in the current shell for an existing confirmed account.');
await post('/api/auth', { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD, mode: 'login' });
const workspaceId = await post('/api/workspace', { name: 'Northstar Studio · Synthetic data' });
const template = seed();
let project = await post('/api/project', { workspaceId, project: template });
project = await post(`/api/project/${project.id}`, { action: 'baseline', expectedVersion: project.version, plan: template.draft });
for (const change of template.changes) project = await post(`/api/project/${project.id}`, { action: 'request', expectedVersion: project.version, change });
console.log('Created a synthetic workspace, baseline and three change requests. No external messages sent.');
