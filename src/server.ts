import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { schedule } from './domain/engine.ts';
import { transition, clientProject, type Command } from './domain/workflow.ts';
import type { Project } from './domain/types.ts';

const root = path.dirname(fileURLToPath(import.meta.url));
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
const dbUrl = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
if (dbUrl && (!dbUrl.startsWith('https://') || !key || key.startsWith('sb_secret_'))) throw Error('Use an HTTPS Supabase URL and publishable key, never a service key.');
if (key.includes('.')) { let role = ''; try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { throw Error('Invalid Supabase key.'); } if (role !== 'anon') throw Error('Use a publishable or anon key, never a privileged key.'); }
const configured = Boolean(dbUrl && key);
const secure = origin.startsWith('https://') ? '; Secure' : '';
const limits = new Map<string, { count: number; at: number }>();
function json(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 262144) throw Error('Request too large.'); }
  const result = JSON.parse(raw || '{}'); if (!result || Array.isArray(result) || typeof result !== 'object') throw Error('Invalid request.'); return result;
}
function cookies(req: IncomingMessage): Record<string, string> { return Object.fromEntries((req.headers.cookie || '').split(';').filter(s => s.includes('=')).map(s => { const i = s.indexOf('='); return [s.slice(0, i).trim(), decodeURIComponent(s.slice(i + 1))]; })); }
function session(res: ServerResponse, token: string, refresh: string) { res.setHeader('Set-Cookie', [`ss_access=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${secure}`, `ss_refresh=${encodeURIComponent(refresh)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`]); }
async function supabase(endpoint: string, token?: string, payload?: unknown, method?: string): Promise<any> {
  const response = await fetch(`${dbUrl}${endpoint}`, { method: method || (payload === undefined ? 'GET' : 'POST'), headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(response.status === 401 ? 'Sign in again.' : data?.code === '40001' ? 'This record changed. Reload before saving.' : data?.message || data?.msg || 'Database request failed.');
  return data;
}
async function authenticated(req: IncomingMessage, res: ServerResponse) {
  const c = cookies(req); let token = c.ss_access;
  if (!token && !c.ss_refresh) throw Error('Sign in first.');
  let user;
  try { user = await supabase('/auth/v1/user', token); }
  catch {
    if (!c.ss_refresh) throw Error('Sign in again.');
    const refreshed = await supabase('/auth/v1/token?grant_type=refresh_token', undefined, { refresh_token: c.ss_refresh });
    session(res, refreshed.access_token, refreshed.refresh_token); token = refreshed.access_token;
    user = await supabase('/auth/v1/user', token);
  }
  if (!user?.id) throw Error('Sign in again.');
  return { token, user };
}
async function rpc(name: string, token: string, payload: unknown = {}) { return supabase(`/rest/v1/rpc/${name}`, token, payload); }
export async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  let pathname = '/';
  try {
    pathname = new URL(req.url || '/', origin).pathname;
    if (pathname === '/api/config') return json(res, 200, { configured });
    if (pathname.startsWith('/api/')) {
      if (!configured) return json(res, 503, { error: 'Authenticated mode is unavailable until Supabase is configured. The demo works independently.' });
      if (req.method !== 'GET') {
        if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return json(res, 403, { error: 'Invalid request origin or content type.' });
        const ip = req.socket.remoteAddress || 'local'; const now = Date.now();
        if (limits.size > 10000) for (const [id, rate] of limits) if (now - rate.at > 60000) limits.delete(id);
        const rate = limits.get(ip); if (rate && now - rate.at < 60000) { if (++rate.count > 40) return json(res, 429, { error: 'Too many requests. Try again in a minute.' }); } else limits.set(ip, { count: 1, at: now });
      }
      if (pathname === '/api/auth' && req.method === 'POST') {
        const b = await body(req); if (typeof b.email !== 'string' || !/^.{1,120}@.{1,120}\..+$/.test(b.email) || typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 200) throw Error('Enter a valid email and password of at least eight characters.');
        if (b.mode === 'signup') {
          const result = await supabase('/auth/v1/signup', undefined, { email: b.email, password: b.password });
          if (result.access_token) session(res, result.access_token, result.refresh_token);
          return json(res, 200, { message: result.access_token ? 'Account created. Open your workspace.' : 'Check your confirmation email. Delivery depends on your Supabase email configuration.', signedIn: Boolean(result.access_token) });
        }
        const result = await supabase('/auth/v1/token?grant_type=password', undefined, { email: b.email, password: b.password });
        session(res, result.access_token, result.refresh_token); return json(res, 200, { signedIn: true });
      }
      if (pathname === '/api/logout' && req.method === 'POST') { const c = cookies(req); if (c.ss_access) await supabase('/auth/v1/logout', c.ss_access, undefined, 'POST'); session(res, '', ''); return json(res, 200, { ok: true }); }
      const { token, user } = await authenticated(req, res);
      if (pathname === '/api/members' && req.method === 'GET') return json(res, 200, await rpc('ss_members', token, { p_project: new URL(req.url!, origin).searchParams.get('project') }));
      if (pathname === '/api/revoke' && req.method === 'POST') { const b = await body(req); return json(res, 200, await rpc('ss_revoke_access', token, { p_project: b.projectId, p_user: b.userId })); }
      if (pathname === '/api/workspace' && req.method === 'GET') return json(res, 200, await rpc('ss_workspace', token));
      if (pathname === '/api/workspace' && req.method === 'POST') { const b = await body(req); return json(res, 200, await rpc('ss_create_workspace', token, { p_name: b.name })); }
      if (pathname === '/api/project' && req.method === 'POST') {
        const b = await body(req); const project = b.project as Project;
        if (!project || !project.name?.trim() || project.name.length > 200) throw Error('Enter a project name.');
        schedule(project.draft);
        return json(res, 200, await rpc('ss_create_project', token, { p_workspace: b.workspaceId, p_name: project.name, p_client: project.client, p_draft: project.draft }));
      }
      const match = pathname.match(/^\/api\/project\/([a-zA-Z0-9-]+)$/);
      if (match && req.method === 'GET') return json(res, 200, await rpc('ss_get_project', token, { p_id: match[1] }));
      if (match && req.method === 'POST') {
        const command = await body(req) as unknown as Command;
        const current = await rpc('ss_get_project', token, { p_id: match[1] }) as Project;
        // Client records intentionally lack cost data. Their restricted decision command is validated in SQL.
        if (current.role === 'client') {
          if (!['decide', 'request'].includes(command.action)) throw Error('You do not have permission for this action.');
          return json(res, 200, await rpc('ss_client_command', token, { p_id: match[1], p_command: command }));
        }
        if (command.scenario) command.scenario.result = schedule(command.scenario.plan);
        const next = transition(current, command, user.email || user.id);
        const saved = await rpc('ss_save_project', token, { p_id: match[1], p_version: command.expectedVersion, p_command: command, p_next: next });
        return json(res, 200, saved.role === 'client' ? clientProject(saved) : saved);
      }
      if (pathname === '/api/invite' && req.method === 'POST') { const b = await body(req); return json(res, 200, await rpc('ss_invite', token, { p_project: b.projectId, p_email: b.email, p_role: b.role })); }
      if (pathname === '/api/accept' && req.method === 'POST') { const b = await body(req); return json(res, 200, await rpc('ss_accept_invite', token, { p_token: b.token })); }
      return json(res, 404, { error: 'Endpoint not found.' });
    }
    if (!['GET', 'HEAD'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed.' });
    const allowed = pathname.match(/^\/(app\.js|demo\.js|styles\.css|domain\/(engine|types|workflow|seed)\.js)$/);
    if (!allowed && !['/', '/demo', '/workspace', '/login'].includes(pathname)) return json(res, 404, { error: 'Page not found.' });
    let file = allowed ? pathname.slice(1) : 'index.html';
    let content: string | Buffer;
    if (file.endsWith('.js') && root.endsWith('src')) {
      content = stripTypeScriptTypes(await readFile(path.join(root, file.replace(/\.js$/, '.ts')), 'utf8'), { mode: 'strip' }).replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
    } else content = await readFile(path.join(root, file));
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    // Log event type only: never paths/query tokens, payloads or credentials.
    console.error(JSON.stringify({ event: 'request_failed', category: pathname.startsWith('/api/') ? 'api' : 'static' }));
    json(res, message.includes('Sign in') ? 401 : message.includes('permission') ? 403 : message.includes('changed') ? 409 : 400, { error: message });
  }
}
export const server = createServer(handler);
if (process.env.NODE_ENV !== 'test') server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`ScopeShift ready at ${origin} · persistent mode ${configured ? 'configured' : 'unconfigured'}`));
