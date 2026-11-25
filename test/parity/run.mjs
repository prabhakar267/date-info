#!/usr/bin/env node
// Byte-for-byte parity check: PHP reference (from master) vs js/date-info.js.
//
//   node test/parity/run.mjs              grid against the mock upstreams
//   node test/parity/run.mjs --self-test  PHP vs PHP, then PHP vs PHP with one
//                                         byte changed (must catch exactly one)
//
// The PHP asks vizgr for historical events, the port asks Wikipedia. Both mocks
// give no events for the grid's dates, so the bodies must still be identical.
// PARITY_IMPL=<file> tests another module exporting getDateInfo instead.
// Exit code: 0 all match, 1 mismatches, 2 harness error.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureDates } from './fixtures.mjs';
import { startMock } from './mock-server.mjs';
import { freePort, startPhp } from './php-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// PARITY_IMPL points the harness at another module with the same export.
const JS_PORT = path.resolve(process.env.PARITY_IMPL || path.join(HERE, '../../js/date-info.js'));
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

// [day, month, year] of `ms` in Asia/Kolkata (no DST there).
function istDate(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  return [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()];
}

const q = (d, m, y) => `day=${d}&month=${m}&year=${y}`;

// Each case is [label, raw query string]. The query is sent to PHP exactly as
// written, so encode anything that must not be a literal byte.
function buildGrid(nowMs) {
  const grid = [
    ['no params', ''],
    ['missing day', 'month=1&year=2015'],
    ['missing month', 'day=1&year=2015'],
    ['missing year', 'day=1&month=1'],
    ['only day', 'day=1'],
    ['unrelated params', 'foo=1&bar=2'],
    ['all empty', 'day=&month=&year='],
    ['empty day', 'day=&month=1&year=2015'],
    ['empty month', 'day=1&month=&year=2015'],
    ['empty year', 'day=1&month=1&year='],
    ['day without =', 'day&month=1&year=2015'],
  ];

  const DAY = 24 * 3600 * 1000;
  for (const [label, offset] of [['yesterday', -1], ['today', 0], ['tomorrow', 1]]) {
    const [d, m, y] = istDate(nowMs + offset * DAY);
    grid.push([`${label} IST`, q(d, m, y)]);
  }
  const [td, tm, ty] = istDate(nowMs);
  grid.push(['today IST zero-padded', q(String(td).padStart(2, '0'), String(tm).padStart(2, '0'), ty)]);
  grid.push(['today IST last year', q(td, tm, ty - 1)]);
  grid.push(['today IST next year', q(td, tm, ty + 1)]);
  grid.push(['today IST next month', q(td, tm === 12 ? 1 : tm + 1, ty)]);

  for (const [d, m, y] of [
    [29, 2, 2016], [29, 2, 2015], [29, 2, 1900], [29, 2, 2000], [29, 2, 2024],
    [30, 2, 2016], [31, 4, 2015], [31, 12, 2015], [0, 1, 2015], [32, 1, 2015],
    [1, 0, 2015], [1, 13, 2015], [4, 10, 1582], [15, 10, 1582], [31, 12, 1969],
    [19, 1, 2038], [1, 1, 2030],
  ]) grid.push([`date ${d}/${m}/${y}`, q(d, m, y)]);

  for (const y of [0, 1, 50, 69, 70, 99, 100, 999, 1000, 1582, 1900, 1970, 9999, 10000, 32767, 32768]) {
    grid.push([`year ${y} Jan 1`, q(1, 1, y)]);
    grid.push([`year ${y} Dec 31`, q(31, 12, y)]);
  }

  // 5-digit years pass checkdate up to 32767; strtotime reads them oddly.
  for (const [d, m, y] of [
    [1, 1, 10600], [1, 1, 20000], [1, 1, 24000], [1, 1, 25000], [29, 2, 10012],
    [31, 12, 23599], [15, 6, 32000], [31, 12, 29999],
    // First four digits as a time (hour 10-24, minute 00-59) and not.
    [9, 9, 12345], [10, 10, 12345], [1, 1, 10599], [1, 1, 19999], [31, 12, 24599], [1, 12, 24599],
    [1, 1, 24600], [5, 7, 30000], [31, 12, 32765], [1, 1, 32767],
    // 29 Feb of a leap 5-digit year whose 200X year is not leap rolls to 1 Mar.
    [29, 2, 10016], [29, 2, 10020], [29, 2, 25012], [29, 2, 32764],
  ]) grid.push([`5-digit year ${d}/${m}/${y}`, q(d, m, y)]);

  // 1-2 digit years read as 20xx/19xx, 3-digit years kept.
  for (const [d, m, y] of [[29, 2, 4], [1, 9, 9], [12, 10, 10], [31, 12, 68], [29, 2, 96], [29, 2, 400], [5, 5, 123]]) {
    grid.push([`short year ${d}/${m}/${y}`, q(d, m, y)]);
  }
  for (const [label, offset] of [['yesterday', -1], ['today', 0], ['tomorrow', 1]]) {
    const [d, m, y] = istDate(nowMs + offset * DAY);
    grid.push([`${label} IST as 2-digit year`, q(d, m, y % 100)]);
  }

  // Odd values use dates away from the fixtures so they hit the default reply.
  const oddValues = [
    ['" 5"', '%205'], ['"5abc"', '5abc'], ['"+5"', '%2B5'], ['raw + (decodes to " 5")', '+5'],
    ['"-5"', '-5'], ['"1e1"', '1e1'], ['"1.9"', '1.9'], ['"0x1A"', '0x1A'], ['"05"', '05'],
    ['"\\t5"', '%095'], ['"5 "', '5%20'], ['huge', '99999999999999999999'], ['"abc"', 'abc'],
  ];
  for (const [label, v] of oddValues) {
    grid.push([`day ${label}`, q(v, 2, 2016)]);
    grid.push([`month ${label}`, q(12, v, 2016)]);
    grid.push([`year ${label}`, q(12, 1, v)]);
  }
  for (const [label, v] of [
    ['" 2015"', '%202015'], ['"2015abc"', '2015abc'], ['"+2015"', '%2B2015'], ['"-2015"', '-2015'],
    ['"2.015e3"', '2.015e3'], ['"0x7DF"', '0x7DF'], ['"02015"', '02015'], ['"2015.9"', '2015.9'],
  ]) grid.push([`year ${label}`, q(12, 1, v)]);

  grid.push(
    ['duplicate day (last wins)', 'day=1&day=2&month=1&year=2015'],
    ['duplicate year (last wins)', 'day=1&month=1&year=2015&year=2016'],
    ['duplicate day, last empty', 'day=1&month=1&year=2015&day='],
    ['day[]=1', 'day[]=1&month=1&year=2015'],
    ['day[]=5', 'day[]=5&month=1&year=2015'],
    ['day[]= empty', 'day[]=&month=1&year=2015'],
    ['day[a]=3', 'day[a]=3&month=1&year=2015'],
    ['day then day[]', 'day=5&day[]=2&month=1&year=2015'],
    ['day[] then day', 'day[]=1&day=3&month=1&year=2015'],
    ['all arrays', 'day[]=1&month[]=1&year[]=2015'],
    ['URL-encoded values', 'day=%31&month=%30%31&year=%32%30%31%35'],
    ['URL-encoded key', '%64ay=1&month=1&year=2015'],
    ['encoded & inside day', 'day=1%26month%3D1&year=2015'],
    ['semicolon separator', 'day=1;month=1&year=2015'],
    ['extra unicode param', 'day=1&month=1&year=2015&x=%E2%9C%93'],
  );

  for (const [d, m, y] of fixtureDates) grid.push([`fixture ${y}-${m}-${d}`, q(d, m, y)]);
  return grid;
}

// Upstream requests as path + sorted params, so order of params and of the
// two calls does not matter but their content does. A vizgr request (PHP) and
// a Wikipedia request (JS) both become "events MM/DD", so the two sides must
// ask for events on the same day and month.
function normaliseLog(log) {
  return log.map((u) => {
    const url = new URL(u, 'http://x');
    if (url.pathname === '/vizgr/historical-events/search.php') {
      const date = url.searchParams.get('begin_date') ?? '';
      return `events ${date.slice(4, 6)}/${date.slice(6, 8)}`;
    }
    if (url.pathname.startsWith('/wiki/feed/v1/wikipedia/en/onthisday/events/')) {
      return `events ${url.pathname.split('/').slice(-2).join('/')}`;
    }
    const params = [...url.searchParams].sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
    return `${url.pathname}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`;
  }).sort();
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

// Run every case through PHP and `other`, return the mismatches.
async function runGrid(grid, php, other, mock) {
  const mismatches = [];
  for (const [label, query] of grid) {
    let phpBody, otherBody, phpLog, otherLog;
    for (let attempt = 0; attempt < 2; attempt++) {
      const nowMs = Date.now();
      if (mock) mock.log.length = 0;
      phpBody = await php.request(query).catch((e) => Buffer.from(`<PHP request failed: ${e.message}>`));
      phpLog = mock ? normaliseLog(mock.log.splice(0)) : [];
      otherBody = await other(label, query, nowMs);
      otherLog = mock ? normaliseLog(mock.log.splice(0)) : [];
      // Both sides must see the same IST day; retry once if midnight passed.
      if (istDate(nowMs).join() === istDate(Date.now()).join()) break;
    }
    const at = firstDiff(phpBody, otherBody);
    const logsDiffer = JSON.stringify(phpLog) !== JSON.stringify(otherLog);
    if (at !== -1 || logsDiffer) {
      mismatches.push({ label, query, at, phpBody, otherBody, logsDiffer, phpLog, otherLog });
    }
  }
  return mismatches;
}

function printMismatches(title, mismatches, total) {
  console.log(`\n== ${title}: ${total - mismatches.length}/${total} match, ${mismatches.length} mismatch(es)`);
  for (const m of mismatches) {
    console.log(`\n-- MISMATCH: ${m.label}\n   query: ${JSON.stringify(m.query)}`);
    if (m.at !== -1) {
      console.log(`   first differing byte: ${m.at}`);
      console.log(`   PHP: ${m.phpBody.toString('utf8')}`);
      console.log(`   JS : ${m.otherBody.toString('utf8')}`);
    }
    if (m.logsDiffer) {
      console.log(`   upstream requests differ`);
      console.log(`   PHP: ${JSON.stringify(m.phpLog)}`);
      console.log(`   JS : ${JSON.stringify(m.otherLog)}`);
    }
  }
}

async function loadPort() {
  try {
    return (await import(pathToFileURL(JS_PORT).href)).getDateInfo;
  } catch (e) {
    throw new Error(`cannot load ${JS_PORT}: ${e.message}`);
  }
}

// Wrap getDateInfo so it returns bytes like the PHP side; a throw becomes a body.
function jsImpl(getDateInfo, bases) {
  return async (label, query, nowMs) => {
    try {
      const body = await getDateInfo(new URLSearchParams(query), { ...bases, now: new Date(nowMs), fetch: globalThis.fetch });
      return Buffer.from(typeof body === 'string' ? body : `<non-string result: ${typeof body}> ${body}`, 'utf8');
    } catch (e) {
      return Buffer.from(`<getDateInfo threw: ${e && e.stack ? e.stack : e}>`, 'utf8');
    }
  };
}

const servers = [];
async function start(fn) { const s = await fn(); servers.push(s); return s; }
async function stopAll() { while (servers.length) await servers.pop().stop(); }

async function main() {
  const args = new Set(process.argv.slice(2));

  const mock = await start(startMock);
  const php = await start(() => startPhp({ vizgrBase: mock.vizgrBase, tmdbBase: mock.tmdbBase }));
  const jsBases = { wikiBase: mock.wikiBase, tmdbBase: mock.tmdbBase };
  const grid = buildGrid(Date.now());

  if (args.has('--self-test')) {
    const same = (label, query) => php.request(query);
    const clean = await runGrid(grid, php, same, mock);
    printMismatches('self-test: PHP vs PHP', clean, grid.length);

    const target = 'fixture 2015-1-1';
    const mutated = async (label, query) => {
      const body = Buffer.from(await php.request(query));
      if (label === target) body[Math.floor(body.length / 2)] ^= 1;
      return body;
    };
    const caught = await runGrid(grid, php, mutated, mock);
    printMismatches(`self-test: PHP vs PHP with one byte flipped in "${target}"`, caught, grid.length);

    const ok = clean.length === 0 && caught.length === 1 && caught[0].label === target;
    console.log(`\nself-test ${ok ? 'PASSED' : 'FAILED'}`);
    return ok ? 0 : 1;
  }

  const getDateInfo = await loadPort();
  const mismatches = await runGrid(grid, php, jsImpl(getDateInfo, jsBases), mock);
  printMismatches('grid (mock upstreams)', mismatches, grid.length);

  // Events source refused: point PHP's vizgr and the port's Wikipedia at a
  // port nothing listens on.
  await php.stop();
  servers.splice(servers.indexOf(php), 1);
  const refused = `http://127.0.0.1:${await freePort()}`;
  const php2 = await start(() => startPhp({ vizgrBase: refused, tmdbBase: mock.tmdbBase }));
  const [d, m, y] = istDate(Date.now());
  const refusedGrid = [['events refused 2015-01-01', q(1, 1, 2015)], ['events refused today IST', q(d, m, y)]];
  const refusedMismatches = await runGrid(refusedGrid, php2, jsImpl(getDateInfo, { ...jsBases, wikiBase: refused }), mock);
  printMismatches('events source connection refused', refusedMismatches, refusedGrid.length);

  return mismatches.length + refusedMismatches.length;
}

process.on('SIGINT', () => { stopAll().finally(() => process.exit(130)); });

main()
  .then(async (failures) => { await stopAll(); process.exit(failures ? 1 : 0); })
  .catch(async (e) => { console.error(`harness error: ${e.stack || e}`); await stopAll(); process.exit(2); });
