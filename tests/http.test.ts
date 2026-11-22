import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_PUBLISHABLE_KEY;
const { handler }=await import('../src/server.ts');
async function request(url:string,method='GET') {
  const result:{status:number;headers:Record<string,string>;body:string}={status:0,headers:{},body:''};
  const res={setHeader:(k:string,v:string)=>{result.headers[k]=v;},writeHead:(code:number,headers:Record<string,string>)=>{result.status=code;Object.assign(result.headers,headers);},end:(b:unknown)=>{result.body=String(b||'');}};
  await handler({url,method,headers:{},socket:{remoteAddress:'local'}} as any,res as any);
  return result;
}
test('demo shell serves successfully without credentials',async()=>{const r=await request('/demo');assert.equal(r.status,200);assert.match(r.body,/ScopeShift/);assert.match(r.headers['Content-Security-Policy'],/frame-ancestors 'none'/);});
test('development browser modules are compiled to JavaScript',async()=>{const r=await request('/app.js');assert.equal(r.status,200);assert.equal(r.headers['Content-Type'],'text/javascript; charset=utf-8');assert.match(r.body,/\.\/domain\/engine.js/);assert.doesNotMatch(r.body,/import type/);});
test('private mode reports a setup blocker rather than faking a saved record',async()=>{const r=await request('/api/workspace','POST');assert.equal(r.status,503);assert.match(r.body,/Supabase is configured/);});
test('server does not serve secrets or filesystem traversal',async()=>{for(const url of ['/.env','/../../.env','/src/server.ts']){const r=await request(url);assert.equal(r.status,404);assert.doesNotMatch(r.body,/SUPABASE_PUBLISHABLE_KEY/);}});
