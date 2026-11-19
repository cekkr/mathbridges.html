import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { startDevServer } from '../serve.js';

async function fixture(t, { initial = 'first', delay = 0 } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'mathbridges-server-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src', 'nested'), { recursive: true });
  await mkdir(path.join(root, 'docs'));
  await writeFile(path.join(root, 'src/nested/title.txt'), initial);
  await writeFile(path.join(root, 'generate.mjs'), `
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
const title=await readFile('src/nested/title.txt','utf8');
await appendFile('builds.log','build\\n');
await mkdir('libs',{recursive:true});
await writeFile('libs/app.js','partial');
await new Promise(resolve=>setTimeout(resolve,${delay}));
if(title==='INVALID')throw new Error('Invalid source');
await writeFile('libs/app.js',JSON.stringify(title));
await writeFile('index.html','<!doctype html><html><head></head><body>'+title+'</body></html>');
`);
  const errors = [];
  return { root, errors, logger: { log() {}, error(message) { errors.push(message); } } };
}
async function eventually(fn, message) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.fail(message);
}
async function start(t, options) {
  const dev = await startDevServer({ ...options, port: 0, debounceMs: 30 });
  t.after(() => dev.close());
  return dev;
}

test('startup builds before serving, adds reload only in HTTP, and restricts public files', async t => {
  const f = await fixture(t);
  const dev = await start(t, f);
  await writeFile(path.join(f.root, 'secret.txt'), 'private');
  await symlink(path.join(f.root, 'secret.txt'), path.join(f.root, 'libs/private.txt'));
  await dev.rebuild();
  const response = await fetch(dev.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text();
  assert.match(html, /first/); assert.match(html, /\/__dev\/reload.js\?revision=/);
  assert.doesNotMatch(await readFile(path.join(f.root, 'index.html'), 'utf8'), /__dev/);
  assert.equal(await (await fetch(dev.url + '/libs/app.js')).text(), '"first"');
  for (const name of ['/secret.txt', '/generate.mjs', '/src/nested/title.txt', '/libs/private.txt', '/libs/%2e%2e%2fsecret.txt']) {
    assert.ok([400, 404].includes((await fetch(dev.url + name)).status), name);
  }
  assert.equal((await fetch(dev.url + '/%zz')).status, 400);
  const head = await fetch(dev.url, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal((await fetch(dev.url, { method: 'POST' })).status, 405);
});

test('recursive watches survive atomic saves, coalesce a burst, and publish reload events', async t => {
  const f = await fixture(t);
  const dev = await start(t, f);
  const response = await fetch(dev.url + '/__dev/events');
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  t.after(() => reader.cancel());
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: build/); assert.match(first, /"revision":1/);
  const target = path.join(f.root, 'src/nested/title.txt');
  await writeFile(target, 'second');
  await writeFile(target, 'third');
  await writeFile(target + '.tmp', 'final');
  await rename(target + '.tmp', target);
  const event = new TextDecoder().decode((await reader.read()).value);
  assert.match(event, /event: build/); assert.match(event, /"revision":2/);
  assert.match(await (await fetch(dev.url)).text(), /final/);
  assert.equal((await readFile(path.join(f.root, 'builds.log'), 'utf8')).trim().split('\n').length, 2);
  // The directory watch must remain active after a file is replaced by rename.
  await writeFile(target, 'after-rename');
  await eventually(async () => (await (await fetch(dev.url)).text()).includes('after-rename'), 'atomic replacement must not detach the watcher');
  const buildsBefore = await readFile(path.join(f.root, 'builds.log'), 'utf8');
  await writeFile(target, 'after-rename');
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await readFile(path.join(f.root, 'builds.log'), 'utf8'), buildsBefore, 'unchanged inputs must not trigger another build');
});

test('build failures and in-progress output preserve the last complete snapshot, then recover', async t => {
  const f = await fixture(t, { delay: 150 });
  const dev = await start(t, f);
  const target = path.join(f.root, 'src/nested/title.txt');
  await writeFile(target, 'INVALID');
  await eventually(() => f.errors.length > 0, 'failed build should be reported');
  assert.match(f.errors[0], /last successful build/);
  assert.match(await (await fetch(dev.url)).text(), /first/);
  assert.equal(await (await fetch(dev.url + '/libs/app.js')).text(), '"first"');
  await writeFile(target, 'recovered');
  await eventually(async () => (await (await fetch(dev.url)).text()).includes('recovered'), 'watch should recover after a build error');
  assert.equal(await (await fetch(dev.url + '/libs/app.js')).text(), '"recovered"');
});

test('changes during a build are queued for a subsequent complete build', async t => {
  const f = await fixture(t, { delay: 200 });
  const dev = await start(t, f);
  const target = path.join(f.root, 'src/nested/title.txt');
  await writeFile(target, 'middle');
  await eventually(async () => (await readFile(path.join(f.root, 'builds.log'), 'utf8')).trim().split('\n').length >= 2, 'second build should start');
  assert.equal(await (await fetch(dev.url + '/libs/app.js')).text(), '"first"');
  await writeFile(target, 'newest');
  await eventually(async () => (await (await fetch(dev.url)).text()).includes('newest'), 'save during build must not be dropped');
  assert.equal(await (await fetch(dev.url + '/libs/app.js')).text(), '"newest"');
});

test('a failed initial build prevents startup and closes watches', async t => {
  const f = await fixture(t, { initial: 'INVALID' });
  await assert.rejects(startDevServer({ ...f, port: 0 }), /Invalid source/);
});

test('live reload client reloads only for a new revision and closes its event stream', async t => {
  const f = await fixture(t), dev = await start(t, f);
  const script = await (await fetch(dev.url + '/__dev/reload.js?revision=1')).text();
  const handlers = {}; let reloads = 0, closed = false, onHide;
  vm.runInNewContext(script, {
    EventSource: class { addEventListener(name, callback) { handlers[name] = callback; } close() { closed = true; } },
    location: { reload() { reloads++; } },
    addEventListener(name, callback) { if (name === 'pagehide') onHide = callback; }, console,
  });
  handlers.build({ data: '{"revision":1}' }); assert.equal(reloads, 0);
  handlers.build({ data: '{"revision":2}' }); assert.equal(reloads, 1);
  onHide(); assert.equal(closed, true);
});
