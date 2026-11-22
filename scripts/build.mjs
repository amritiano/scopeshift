import { stripTypeScriptTypes } from 'node:module';
import { readdir, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
async function compile(dir, out) {
  await mkdir(out, { recursive: true });
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const source = path.join(dir, e.name), target = path.join(out, e.name.replace(/\.ts$/, '.js'));
    if (e.isDirectory()) await compile(source, target);
    else if (e.name.endsWith('.ts')) {
      const js = stripTypeScriptTypes(await readFile(source, 'utf8'), { mode: 'strip' }).replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
      await writeFile(target, js);
    } else await cp(source, target);
  }
}
await compile('src', 'dist');
console.log('Built server and browser modules in dist/. Type erasure is not semantic type checking.');
