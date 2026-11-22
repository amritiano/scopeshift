import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
test('Pages artifact supports project subpaths and excludes the authenticated server',async()=>{
 execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'pipe'});
 execFileSync(process.execPath,['scripts/build-pages.mjs'],{env:{...process.env,PAGES_BASE_PATH:'/scopeshift'},stdio:'pipe'});
 for(const route of ['','demo/','login/','workspace/']){
  const html=await readFile(`pages/${route}index.html`,'utf8');
  assert.match(html,/name="scopeshift-mode" content="static-demo"/);
  assert.match(html,/src="\/scopeshift\/app.js"/);
  assert.match(html,/href="\/scopeshift\/styles.css"/);
 }
 const files=await readdir('pages',{recursive:true});
 assert.ok(files.includes('app.js'));
 assert.ok(!files.some(f=>/server\.(js|ts)|\.env|\.sql$|supabase|render\.yaml/.test(f)));
});
