import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import katex from 'katex';
const atlas=JSON.parse(await readFile(new URL('../src/content/atlas.json',import.meta.url)));
const locales=await Promise.all(['en','it'].map(async lang=>JSON.parse(await readFile(new URL(`../src/locales/${lang}.json`,import.meta.url)))));
test('every bridge has bilingual purpose, conditions, guarantee and worked steps',()=>{
 for(const b of atlas.bridges)for(const locale of locales){const c=locale.bridges[b.id];assert.ok(c.title&&c.summary&&c.when&&c.guarantees&&c.pitfalls,b.id);assert.ok(c.hypotheses.length,b.id);assert.equal(c.steps.length,b.example.steps.length,b.id);}
});
test('all source formulas render with KaTeX without errors',()=>{
 for(const b of atlas.bridges)for(const latex of [b.formulaLatex,b.example.formulaLatex,...b.example.steps.map(s=>s.formulaLatex)])assert.doesNotThrow(()=>katex.renderToString(latex,{throwOnError:true,strict:'error'}),`${b.id}: ${latex}`);
});
test('all canonical relationships and route stops exist',()=>{
 const ids=new Set(atlas.bridges.map(b=>b.id));assert.equal(ids.size,atlas.bridges.length);
 for(const b of atlas.bridges)for(const id of [...b.prerequisites,...b.relatedIds])assert.ok(ids.has(id),`${b.id}: ${id}`);
 for(const route of atlas.routes)for(const id of route.bridgeIds)assert.ok(ids.has(id),id);
 for(const category of atlas.categories)assert.ok(atlas.bridges.some(b=>b.parentId===category.id),category.id);
});
test('generated artifact embeds translations safely and uses only local assets',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.ok(!html.includes('{{DATA}}'));assert.ok(!/<script[^>]+src="https?:/.test(html));
 const data=JSON.parse(html.match(/<script id="atlas-data" type="application\/json">(.*?)<\/script>/s)[1]);assert.equal(data.atlas.bridges.length,atlas.bridges.length);assert.ok(data.maps.en.all&&data.maps.it.all);
});
