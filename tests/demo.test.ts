import test from 'node:test';
import assert from 'node:assert/strict';
const store = new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>store.get(k)||null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)}});
const { demo }=await import('../src/demo.ts');
test('demo storage is isolated, persistent and resettable',()=>{const p=demo.reset();const next=demo.save(p,{action:'request',expectedVersion:p.version,change:{...p.changes[0],id:'local-only'}});assert.equal(demo.load().version,next.version);assert.equal(demo.load().changes.length,4);assert.equal(demo.reset().changes.length,3);});
test('stale tabs cannot overwrite a newer demo',()=>{const p=demo.reset();demo.save(p,{action:'request',expectedVersion:p.version,change:{...p.changes[0],id:'local-only'}});assert.throws(()=>demo.save(p,{action:'request',expectedVersion:p.version,change:{...p.changes[0],id:'stale'}}),/another tab/);demo.reset();});
