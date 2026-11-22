import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import path from 'node:path';

// The deployment artifact is explicitly whitelisted: never publish dist/server.js, SQL or .env.
const raw = process.env.PAGES_BASE_PATH || '';
if (raw && !/^\/[A-Za-z0-9._-]+\/?$/.test(raw)) throw Error('PAGES_BASE_PATH must be empty or a single /repository-name path.');
const base = raw.replace(/\/$/, '');
const destination = 'pages';
await mkdir(destination, { recursive: true });
for (const file of ['app.js', 'demo.js', 'styles.css']) await cp(path.join('dist', file), path.join(destination, file));
await mkdir(path.join(destination, 'domain'), { recursive: true });
for (const file of ['engine.js', 'seed.js', 'workflow.js', 'types.js']) await cp(path.join('dist/domain', file), path.join(destination, 'domain', file));
const html = (await readFile('dist/index.html', 'utf8'))
  .replace('<head>', `<head><meta name="scopeshift-mode" content="static-demo"><meta name="scopeshift-base" content="${base}">`)
  .replace('href="/styles.css"', `href="${base}/styles.css"`)
  .replace('src="/app.js"', `src="${base}/app.js"`);
await writeFile(path.join(destination, 'index.html'), html);
for (const route of ['demo', 'login', 'workspace']) {
  await mkdir(path.join(destination, route), { recursive: true });
  await writeFile(path.join(destination, route, 'index.html'), html);
}
await writeFile(path.join(destination, '.nojekyll'), '');
const expected = new Set(['app.js', 'demo.js', 'styles.css', 'domain', 'index.html', 'demo', 'login', 'workspace', '.nojekyll']);
for (const entry of await readdir(destination)) if (!expected.has(entry)) throw Error(`Unexpected static artifact: ${entry}. Use a fresh pages output directory.`);
console.log(`Built isolated GitHub Pages demo for ${base || '/'}; authenticated server and secrets excluded.`);
