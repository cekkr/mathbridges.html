import http from 'node:http';
import { watch as watchDirectory } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

// Some platforms report delayed/duplicate watch events. Only rebuild changed inputs.
async function inputFingerprint(root) {
  const files = [];
  async function collect(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const name = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(name);
      else if (entry.isFile()) files.push(name);
    }
  }
  await Promise.all(['src', 'docs'].map(collect));
  files.push('generate.mjs', 'package.json', 'package-lock.json');
  const hash = createHash('sha256');
  for (const name of files.sort()) {
    hash.update(JSON.stringify(name));
    try { hash.update(await readFile(path.join(root, name))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; hash.update('missing'); }
  }
  return hash.digest('hex');
}

// Read the complete build before publishing it. Requests never see half-written bundles.
async function loadSnapshot(root) {
  const files = new Map([['/index.html', await readFile(path.join(root, 'index.html'))]]);
  async function collect(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async entry => {
      const full = path.join(directory, entry.name), url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await collect(full, url);
      else if (entry.isFile()) files.set(url, await readFile(full));
      // Do not follow symlinks into source files or outside the generated directory.
    }));
  }
  await collect(path.join(root, 'libs'), '/libs');
  return files;
}

function reloadScript(revision) {
  return `(() => {
  const events = new EventSource('/__dev/events');
  events.addEventListener('build', event => {
    if (JSON.parse(event.data).revision !== ${revision}) location.reload();
  });
  events.addEventListener('build-error', event => {
    console.error('[Math Bridges] Build failed; keeping the last successful page.', JSON.parse(event.data).message);
  });
  addEventListener('pagehide', () => events.close());
})();`;
}

export async function startDevServer({ root = projectRoot, port = Number(process.env.PORT ?? 4173), debounceMs = 100, logger = console } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer between 0 and 65535.');
  let snapshot, lastInputs, revision = 0, timer, building, child, pending = false, forcePending = false, closing = false;
  const watchers = [], clients = new Set();
  const broadcast = (event, data) => {
    for (const client of clients) client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  function runGenerator() {
    return new Promise((resolve, reject) => {
      child = spawn(process.execPath, [path.join(root, 'generate.mjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', errors = '';
      child.stdout.on('data', data => { output = (output + data).slice(-32000); });
      child.stderr.on('data', data => { errors = (errors + data).slice(-32000); });
      child.once('error', reject);
      child.once('close', code => {
        child = null;
        if (code === 0) resolve(output.trim());
        else reject(new Error(errors.trim() || output.trim() || `Generator exited with code ${code}.`));
      });
    });
  }
  function rebuild({ force = true } = {}) {
    pending = true;
    forcePending ||= force;
    if (building) return building;
    building = (async () => {
      while (pending && !closing) {
        pending = false;
        const forced = forcePending;
        forcePending = false;
        const started = performance.now();
        try {
          const inputs = await inputFingerprint(root);
          if (!forced && inputs === lastInputs) continue;
          lastInputs = inputs;
          await runGenerator();
          const next = await loadSnapshot(root);
          if (closing) break;
          snapshot = next;
          revision++;
          logger.log(`Built in ${Math.round(performance.now() - started)} ms.`);
          broadcast('build', { revision });
        } catch (error) {
          if (closing) break;
          if (!snapshot) throw error;
          logger.error(`Build failed; serving the last successful build.\n${error.message}`);
          broadcast('build-error', { message: error.message });
        }
      }
    })().finally(() => { building = null; });
    return building;
  }
  function scheduleBuild() {
    if (closing) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void rebuild({ force: false }).catch(error => logger.error(error.message)); }, debounceMs);
  }
  function watchInputs(directory, options, accept = () => true) {
    const watcher = watchDirectory(directory, options, (_event, filename) => {
      if ((!filename || accept(String(filename))) && !String(filename).includes('.DS_Store')) scheduleBuild();
    });
    watcher.on('error', error => logger.error(`Watch error for ${directory}: ${error.message}. Restart the server after fixing it.`));
    watchers.push(watcher);
  }
  const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    let url, pathname;
    try {
      url = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\\') || pathname.split('/').includes('..')) throw new Error('Invalid path');
    } catch { res.writeHead(400).end('Bad request'); return; }
    if (pathname === '/__dev/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: build\ndata: ${JSON.stringify({ revision })}\n\n`);
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return;
    }
    let body, type;
    if (pathname === '/__dev/reload.js') {
      const pageRevision = Number(url.searchParams.get('revision'));
      body = Buffer.from(reloadScript(Number.isSafeInteger(pageRevision) ? pageRevision : revision));
      type = mimeTypes['.js'];
    } else {
      const name = pathname === '/' ? '/index.html' : pathname;
      body = snapshot.get(name);
      if (!body) { res.writeHead(404).end('Not found'); return; }
      type = mimeTypes[path.extname(name)] || 'application/octet-stream';
      if (name === '/index.html') body = Buffer.from(body.toString('utf8').replace('</head>', `<script defer src="/__dev/reload.js?revision=${revision}"></script></head>`));
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.byteLength, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  async function close() {
    closing = true;
    clearTimeout(timer);
    watchers.forEach(watcher => watcher.close());
    child?.kill('SIGTERM');
    await building?.catch(() => {});
    for (const client of clients) client.end();
    clients.clear();
    if (server.listening) {
      const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server.closeAllConnections();
      await closed;
    }
  }
  try {
    watchInputs(path.join(root, 'src'), { recursive: true });
    watchInputs(path.join(root, 'docs'), { recursive: true });
    watchInputs(root, {}, filename => ['generate.mjs', 'package.json', 'package-lock.json'].includes(filename));
    await rebuild();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    logger.log(`Local: ${url}\nWatching src/, docs/, generate.mjs, and package manifests. Ctrl+C to stop.`);
    return { url, close, rebuild };
  } catch (error) { await close(); throw error; }
}

export async function runCLI() {
  try {
    const dev = await startDevServer();
    const stop = () => { void dev.close().catch(error => { console.error(error.message); process.exitCode = 1; }); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) { console.error(`Cannot start Math Bridges: ${error.message}`); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCLI();
