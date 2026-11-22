import test from 'node:test';
import assert from 'node:assert/strict';
const storage=new Map<string,string>();
const staticMode=process.env.SCOPESHIFT_TEST_STATIC==='1';
const links:{href:string}[]=[];
let requests=0;
const listeners=new Map<string,(event:any)=>Promise<void>>();
const app={innerHTML:'',addEventListener:(type:string,handler:any)=>listeners.set(type,handler)};
const toast={textContent:'',classList:{add:()=>{},remove:()=>{}}};
Object.defineProperty(globalThis,'document',{value:{querySelector:(selector:string)=>selector==='#app'?app:selector==='#toast'?toast:staticMode&&selector==='meta[name="scopeshift-mode"]'?{content:'static-demo'}:staticMode&&selector==='meta[name="scopeshift-base"]'?{content:'/scopeshift'}:null,querySelectorAll:()=>[...app.innerHTML.matchAll(/href="(\/[^"]*)"/g)].map(match=>{const item={href:match[1]};links.push(item);return{getAttribute:()=>item.href,setAttribute:(_key:string,value:string)=>{item.href=value;}};})}});
Object.defineProperty(globalThis,'location',{value:{pathname:staticMode?'/scopeshift/demo/':'/demo',hash:'',origin:'http://localhost:3000',search:''}});
Object.defineProperty(globalThis,'history',{value:{replaceState:()=>{}}});
Object.defineProperty(globalThis,'window',{value:{addEventListener:()=>{},scrollTo:()=>{}}});
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
Object.defineProperty(globalThis,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
Object.defineProperty(globalThis,'fetch',{value:async()=>{requests++;if(staticMode)throw Error('Static demo must not request a private API');return{ok:true,json:async()=>({configured:false})};}});
// Controller harness supplies successful native form values. It does not simulate layout or browser constraint validation.
Object.defineProperty(globalThis,'FormData',{value:class{entries:[string,string][];constructor(form:any){this.entries=form.values;}get(k:string){return this.entries.find(([key])=>key===k)?.[1]||null;}getAll(k:string){return this.entries.filter(([key])=>key===k).map(([,value])=>value);}[Symbol.iterator](){return this.entries[Symbol.iterator]();}}});
await import('../src/app.ts');
async function click(action:string,id?:string) {const b={dataset:{action,id},disabled:false};await listeners.get('click')!({target:{closest:()=>b}});}
async function submit(id:string,values:[string,string][],decision?:{id:string;revision:string}){const form={id,values,dataset:decision||{},classList:{contains:(s:string)=>s==='decision'&&Boolean(decision)}};await listeners.get('submit')!({preventDefault:()=>{},target:form,submitter:{disabled:false,value:'approve'}});}
const saved=()=>JSON.parse(storage.get('scopeshift-demo-v1')!);
test('UI controller completes demo compare → approve → apply with preserved history',async()=>{
 assert.match(app.innerHTML,/Customer Support Agent Rollout/);
 await click('analyze','hindi'); assert.match(app.innerHTML,/Three ways forward/);
 await submit('calculate',[['defer','launch'],['extraName','Nora'],['extraHours','8'],['extraRate','180000'],['extraStart','2026-11-23'],['onboarding','6']]);
 assert.match(app.innerHTML,/Deadline infeasible/);assert.equal(saved().scenarios[0].items.length,3);
 await click('choose','extend');await click('submit-proposal');
 assert.equal(saved().proposals[0].status,'pending');assert.match(app.innerHTML,/Approve revision 1/);
 await submit('',[['note','Extended delivery date accepted']],{id:'hindi-r1',revision:'1'});
 assert.equal(saved().proposals[0].status,'approved');await click('apply','hindi-r1');
 assert.equal(saved().baselines.length,2);assert.equal(saved().proposals[0].status,'applied');assert.match(app.innerHTML,/Baseline revisions/);assert.match(app.innerHTML,/Revision 1/);assert.match(app.innerHTML,/Revision 2/);
 if(staticMode){assert.equal(requests,0);assert.ok(links.length>0);assert.ok(links.every(link=>link.href.startsWith('/scopeshift/')));}
});
