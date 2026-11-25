// Dependency-free mock of the two upstreams, bound to 127.0.0.1.
//
//   /vizgr/historical-events/search.php?begin_date=YYYYMMDD&...  -> XML
//   /tmdb/3/discover/movie?primary_release_date.gte=YYYY-MM-DD&... -> JSON
//
// Every request is appended to `log` so the runner can check that both
// implementations asked the upstreams for the same thing.

import http from 'node:http';
import * as fixtures from './fixtures.mjs';

export async function startMock() {
  const log = [];
  const timers = new Set();
  const sockets = new Set();

  const later = (ms, fn) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
  };

  const server = http.createServer((req, res) => {
    log.push(req.url);
    const url = new URL(req.url, 'http://127.0.0.1');
    let fixture;
    if (url.pathname === '/vizgr/historical-events/search.php') {
      const date = url.searchParams.get('begin_date') ?? '';
      fixture = fixtures.vizgr[date] ?? fixtures.defaultVizgr(date);
    } else if (url.pathname === '/tmdb/3/discover/movie') {
      const date = url.searchParams.get('primary_release_date.gte') ?? '';
      fixture = fixtures.tmdb[date] ?? fixtures.defaultTmdb(date);
    } else {
      fixture = { status: 404, contentType: 'text/plain', body: 'not found' };
    }

    const send = () => {
      res.writeHead(fixture.status, { 'Content-Type': fixture.contentType });
      res.end(fixture.body);
    };

    if (fixture.behavior === 'reset') req.socket.destroy();
    else if (fixture.behavior === 'stall') later(fixtures.STALL_MS, () => req.socket.destroy());
    else if (fixture.behavior === 'slow') later(fixtures.SLOW_MS, send);
    else send();
  });

  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    port,
    vizgrBase: `http://127.0.0.1:${port}/vizgr`,
    tmdbBase: `http://127.0.0.1:${port}/tmdb`,
    log,
    async stop() {
      for (const t of timers) clearTimeout(t);
      for (const s of sockets) s.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
