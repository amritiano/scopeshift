import { readdir, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
let failures = 0;
async function check(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['dist', 'node_modules', '.git'].includes(e.name)) continue;
    const file = `${dir}/${e.name}`;
    if (e.isDirectory()) await check(file);
    else if (/\.(ts|mjs|css|html|json|sql|md)$/.test(e.name)) {
      const text = await readFile(file, 'utf8');
      if (e.name.endsWith('.ts')) stripTypeScriptTypes(text, { mode: 'strip' });
      if (e.name.endsWith('.json')) JSON.parse(text);
      const formatted = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n').replace(/\n*$/, '\n');
      if (text !== formatted) {
        if (process.argv.includes('--write')) await writeFile(file, formatted);
        else { console.error(`Whitespace: ${file}`); failures++; }
      }
      if (/\beval\s*\(|new Function\s*\(/.test(text) && !file.endsWith('check.mjs')) { console.error(`Unsafe dynamic code: ${file}`); failures++; }
    }
  }
}
await check('.');
if (failures) process.exitCode = 1;
else console.log('Source syntax, JSON, whitespace and unsafe-evaluation checks passed. This is a focused local checker, not ESLint.');
