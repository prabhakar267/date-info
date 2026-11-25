// Reference PHP runner.
//
// Copies the PHP API from the master branch (not the working tree, so this
// keeps working after the PHP files are removed) into a temp dir, rewrites the
// two upstream base URLs, and serves it with a single `php -S` process bound
// to 127.0.0.1.

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PHP_FILES = ['index.php', 'inc/func.inc.php', 'inc/globals.inc.php'];
const VIZGR = 'http://www.vizgr.org';
const TMDB = 'http://api.themoviedb.org';

export const PHP_BIN = process.env.PHP_BIN
  || (fs.existsSync('/opt/homebrew/bin/php') ? '/opt/homebrew/bin/php' : 'php');

// Plain git fails here with an xcrun architecture error, so run it as arm64.
function gitShow(file) {
  return execFileSync('arch', ['-arm64', 'git', '-C', REPO, 'show', `master:${file}`], { encoding: 'utf8' });
}

// Copy master's PHP into a temp dir. Pass null bases to keep the real URLs.
function copyPhp(vizgrBase, tmdbBase) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'date-info-php-'));
  let vizgrHits = 0;
  let tmdbHits = 0;
  for (const file of PHP_FILES) {
    let src = gitShow(file);
    if (vizgrBase) src = src.replaceAll(VIZGR, () => { vizgrHits++; return vizgrBase; });
    if (tmdbBase) src = src.replaceAll(TMDB, () => { tmdbHits++; return tmdbBase; });
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), src);
  }
  if ((vizgrBase && vizgrHits !== 1) || (tmdbBase && tmdbHits !== 1)) {
    throw new Error(`expected one vizgr and one TMDB URL in master's PHP, found ${vizgrHits} and ${tmdbHits}`);
  }
  return dir;
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// Send `rawQuery` byte for byte (no URL normalisation) and return the body.
function get(port, rawQuery, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: `/index.php?${rawQuery}`, timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error(`PHP request timed out after ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end();
  });
}

export async function startPhp({ vizgrBase = null, tmdbBase = null } = {}) {
  const dir = copyPhp(vizgrBase, tmdbBase);
  const port = await freePort();
  const proc = spawn(PHP_BIN, ['-S', `127.0.0.1:${port}`, '-t', dir], { stdio: 'ignore' });
  let exited = false;
  proc.on('exit', () => { exited = true; });

  // Wait until the server accepts connections.
  for (let i = 0; ; i++) {
    if (exited) throw new Error(`${PHP_BIN} -S exited on start`);
    try {
      await get(port, '', 1000);
      break;
    } catch (e) {
      if (i > 50) throw new Error(`php -S did not start: ${e.message}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return {
    dir,
    port,
    request: (rawQuery, timeoutMs = 120000) => get(port, rawQuery, timeoutMs),
    async stop() {
      if (!exited) await new Promise((resolve) => { proc.on('exit', resolve); proc.kill(); });
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
