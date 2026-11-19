import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { Transformer } from 'markmap-lib';

const root = path.dirname(fileURLToPath(import.meta.url));
const readJSON = async name => JSON.parse(await readFile(path.join(root, 'src', name), 'utf8'));
const [atlas, en, it, template] = await Promise.all([
  readJSON('content/atlas.json'), readJSON('locales/en.json'), readJSON('locales/it.json'),
  readFile(path.join(root, 'src/templates/index.html'), 'utf8')
]);
const locales = { en, it };
const ids = new Set(atlas.bridges.map(b => b.id));
if (ids.size !== atlas.bridges.length) throw new Error('Duplicate bridge IDs');
for (const b of atlas.bridges) {
  if (!atlas.categories.some(c => c.id === b.parentId)) throw new Error(`Invalid parent: ${b.id}`);
  if (!b.domainIds.every(id => atlas.domains.some(d => d.id === id))) throw new Error(`Invalid domain: ${b.id}`);
  if (![...b.relatedIds,...b.prerequisites].every(id => ids.has(id))) throw new Error(`Broken relation: ${b.id}`);
  for (const [lang, data] of Object.entries(locales)) {
    if (!data.bridges[b.id]?.title || data.bridges[b.id]?.steps?.length !== b.example.steps.length) throw new Error(`Incomplete ${lang} content: ${b.id}`);
  }
}
function keys(value, prefix = '') {
  return Object.entries(value).flatMap(([key,v]) => v && !Array.isArray(v) && typeof v === 'object' ? keys(v, `${prefix}${key}.`) : `${prefix}${key}`).sort();
}
if (JSON.stringify(keys(en)) !== JSON.stringify(keys(it))) throw new Error('Translation keys differ');
for (const route of atlas.routes) if (!route.bridgeIds.every(id => ids.has(id))) throw new Error(`Broken route: ${route.id}`);
const transformer = new Transformer();
const maps = {};
for (const [lang, data] of Object.entries(locales)) {
  maps[lang] = {};
  for (const scope of ['all', ...atlas.categories.map(c => c.id)]) {
    const lines = [`# ${scope === 'all' ? data.ui.appName : data.categories[scope].title}`];
    for (const category of atlas.categories.filter(c => scope === 'all' || c.id === scope)) {
      lines.push(`## ${data.categories[category.id].title}`);
      for (const b of atlas.bridges.filter(b => b.parentId === category.id)) lines.push(`### [${data.bridges[b.id].title}](#bridge/${b.id})`);
    }
    maps[lang][scope] = transformer.transform(lines.join('\n')).root;
  }
}
// Only replace the dedicated generated directory, never source or project documents.
const output = path.join(root, 'libs');
await rm(output, { recursive:true, force:true });
await mkdir(path.join(output,'katex'), { recursive:true });
await mkdir(path.join(output,'sources'), { recursive:true });
const worker = await build({ entryPoints:[path.join(root,'src/scripts/solver-worker.js')],bundle:true,write:false,platform:'browser',format:'iife',minify:true,target:['es2022'] });
await writeFile(path.join(output,'solver-worker.js'),worker.outputFiles[0].contents);
await build({entryPoints:[path.join(root,'src/scripts/app.js')],outfile:path.join(output,'app.js'),bundle:true,format:'iife',platform:'browser',minify:true,target:['es2022'],define:{__SOLVER_WORKER_SOURCE__:JSON.stringify(worker.outputFiles[0].text)}});
await Promise.all([
  cp(path.join(root,'node_modules/katex/dist/katex.min.css'),path.join(output,'katex/katex.min.css')),
  cp(path.join(root,'node_modules/katex/dist/fonts'),path.join(output,'katex/fonts'),{recursive:true}),
  cp(path.join(root,'src/styles/app.css'),path.join(output,'styles.css')),
  cp(path.join(root,'src/content'),path.join(output,'content'),{recursive:true}),
  cp(path.join(root,'src/locales'),path.join(output,'locales'),{recursive:true}),
  cp(path.join(root,'docs/atlante_ponti_matematici-ITA.md'),path.join(output,'sources/atlas-ita.md'))
]);
const licenses = ['Dependencies bundled by Math Bridges. See package-lock.json for exact versions.'];
for (const name of ['algebrite','katex','markmap-lib','markmap-view','d3','big-integer']) {
  try { licenses.push(`\n--- ${name} ---\n${await readFile(path.join(root,'node_modules',name,'LICENSE'),'utf8')}`); }
  catch { try { licenses.push(`\n--- ${name} ---\n${await readFile(path.join(root,'node_modules',name,'LICENSE.md'),'utf8')}`); } catch { throw new Error(`Missing license for ${name}`); } }
}
await writeFile(path.join(output,'THIRD_PARTY_LICENSES.txt'),licenses.join('\n'));
const serialized = JSON.stringify({atlas,locales,maps}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
if (!template.includes('{{DATA}}')) throw new Error('Template is missing the data placeholder');
await writeFile(path.join(root,'index.html'),template.replace('{{DATA}}',()=>serialized));
console.log(`Generated index.html and libs/: ${atlas.bridges.length} bridges, ${atlas.categories.length} families, ${Object.keys(locales).length} languages. No runtime CDN requests.`);
