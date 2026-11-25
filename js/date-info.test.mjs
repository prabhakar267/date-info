// Unit tests for js/date-info.js. No network: upstreams are a fake fetch.
// Run with: node --test js/

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkdate, getDateInfo, getDay, languageName, parsePhpJson, parsePhpQuery, parseXml,
  phpFloatToString, phpIntval, phpJsonEncode, phpTrim, strtotimeYnj,
} from './date-info.js';

// 2026-11-25 21:40 UTC is 2026-11-26 03:10 in Asia/Kolkata.
const NOW = new Date('2026-11-25T21:40:00Z');

const VIZGR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <count>2</count>
  <event><date>2015/10/21</date><description>  Kept &amp; trimmed {{cite web}} tail</description></event>
  <event><description><![CDATA[Before <ref>after]]></description></event>
</result>`;

const TMDB_JSON = JSON.stringify({
  results: [
    { title: 'Amélie / Ø 😀', original_language: 'fr' },
    { title: 'Mystery', original_language: 'xx' },
  ],
});

// A fake fetch that records URLs and answers vizgr and TMDB.
function fakeFetch({ vizgr = VIZGR_XML, tmdb = TMDB_JSON, status = 200 } = {}) {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    const body = url.includes('/historical-events/') ? vizgr : tmdb;
    if (body === null) throw new TypeError('network down');
    return new Response(body, { status });
  };
  return { fetch, urls };
}

const info = (query, fetchOptions) => getDateInfo(new URLSearchParams(query), { now: NOW, ...fakeFetch(fetchOptions) });
const ok = (day, month, time, events) => phpJsonEncode({ success: true, day_of_week: day, month_string: month, time, events });
const BAD_PARAMS = '{"success":false,"message":"Please provide correct parameters"}';
const BAD_DATE = '{"success":false,"message":"Invalid Date provided"}';
const PAST = ['Kept & trimmed', 'Before', 'Amélie / Ø 😀 released (French movie)', 'Mystery released ( movie)'];
const FUTURE = ['Kept & trimmed', 'Before', 'Amélie / Ø 😀 releases (French movie)', 'Mystery releases ( movie)'];

test('phpIntval follows PHP 8 numeric-string rules', () => {
  const cases = {
    '': 0n, ' 5': 5n, '\t\n\v\f\r7': 7n, '5abc': 5n, '12abc': 12n, '1e1': 10n, '1e3': 1000n, '1.9': 1n,
    '-1.9': -1n, '.5': 0n, '1.': 1n, '1e': 1n, '1e+': 1n, '0x1A': 0n, '+5': 5n, '-0': 0n, 'abc': 0n, '- 1': 0n,
    '007': 7n, '9223372036854775807': 9223372036854775807n, '9223372036854775808': 9223372036854775807n,
    '-9223372036854775809': -9223372036854775808n, '1e30': 9223372036854775807n, '1e400': 0n,
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(phpIntval(input), expected, JSON.stringify(input));
  assert.equal(phpIntval([]), 0n);
  assert.equal(phpIntval(['']), 1n);
});

test('checkdate uses the proleptic Gregorian calendar, years 1..32767', () => {
  assert.equal(checkdate(2, 29, 2016), true);
  assert.equal(checkdate(2, 29, 2015), false);
  assert.equal(checkdate(2, 29, 1900), false);
  assert.equal(checkdate(2, 29, 2000), true);
  assert.equal(checkdate(1, 1, 1), true);
  assert.equal(checkdate(1, 1, 0), false);
  assert.equal(checkdate(12, 31, 32767), true);
  assert.equal(checkdate(1, 1, 32768), false);
  assert.equal(checkdate(13, 1, 2015), false);
  assert.equal(checkdate(4, 31, 2015), false);
  assert.equal(checkdate(1n, 1n, 9223372036854775807n), false);
});

test('getDay matches the real weekday for Gregorian dates', () => {
  for (const [y, m, d] of [[2015, 10, 21], [2026, 11, 26], [2000, 2, 29], [1900, 3, 1], [1, 1, 1], [9999, 12, 31]]) {
    const t = new Date(0);
    t.setUTCFullYear(y, m - 1, d);
    assert.equal(getDay(d, m, y), t.getUTCDay(), `${y}-${m}-${d}`);
  }
});

test('phpJsonEncode escapes like json_encode with default flags', () => {
  assert.equal(phpJsonEncode({ a: 'x/y', b: true, c: [] }), '{"a":"x\\/y","b":true,"c":[]}');
  assert.equal(phpJsonEncode('é😀'), '"\\u00e9\\ud83d\\ude00"');
  assert.equal(phpJsonEncode('"\\\b\f\n\r\t\x01\x1f\x7f'), '"\\"\\\\\\b\\f\\n\\r\\t\\u0001\\u001f\x7f"');
  assert.equal(phpJsonEncode(['\uD800']), false);
});

test('phpTrim strips only PHP default characters', () => {
  assert.equal(phpTrim(' \t\n\r\0\x0Bx\u00a0 '), 'x\u00a0');
});

test('languageName returns "" for unknown codes', () => {
  assert.equal(languageName('en'), 'English');
  assert.equal(languageName('xx'), '');
  assert.equal(languageName('constructor'), '');
  assert.equal(languageName(null), '');
});

test('phpFloatToString matches PHP precision=14 output', () => {
  const cases = [[1.5, '1.5'], [0.1 + 0.2, '0.3'], [1e14, '1.0E+14'], [99999999999999, '99999999999999'],
    [1e-5, '1.0E-5'], [0.0001, '0.0001'], [-0, '-0'], [0, '0'], [1 / 3, '0.33333333333333'], [Infinity, 'INF']];
  for (const [x, s] of cases) assert.equal(phpFloatToString(x), s, String(x));
});

test('strtotimeYnj follows timelib for short and five-digit years', () => {
  assert.deepEqual(strtotimeYnj(1, 1, 1), { y: 2001, m: 1, d: 1, h: 0, i: 0 });
  assert.deepEqual(strtotimeYnj(69, 1, 1), { y: 2069, m: 1, d: 1, h: 0, i: 0 });
  assert.deepEqual(strtotimeYnj(70, 1, 1), { y: 1970, m: 1, d: 1, h: 0, i: 0 });
  assert.deepEqual(strtotimeYnj(999, 12, 31), { y: 999, m: 12, d: 31, h: 0, i: 0 });
  assert.deepEqual(strtotimeYnj(10000, 1, 1), { y: 2000, m: 1, d: 1, h: 10, i: 0 });
  assert.deepEqual(strtotimeYnj(10012, 2, 29), { y: 2002, m: 3, d: 1, h: 10, i: 1 });
  assert.deepEqual(strtotimeYnj(24599, 12, 31), { y: 2010, m: 1, d: 1, h: 0, i: 59 });
  assert.equal(strtotimeYnj(10600, 1, 1), false);
  assert.equal(strtotimeYnj(25000, 1, 1), false);
  assert.equal(strtotimeYnj(32767, 12, 31), false);
});

test('parsePhpQuery mimics $_GET for duplicates and [] keys', () => {
  const get = parsePhpQuery('day=1&day=2&+month=3&a.b=4&year[]=5&year[x]=6&m[=7&&z');
  assert.equal(get.get('day'), '2');
  assert.equal(get.get('month'), '3');
  assert.equal(get.get('a_b'), '4');
  assert.ok(Array.isArray(get.get('year')));
  assert.equal(get.has('m'), false);
  assert.equal(get.get('z'), '');
  assert.equal(parsePhpQuery('day[]=1&day=2').get('day'), '2');
  assert.equal(parsePhpQuery(`day${'[a]'.repeat(65)}=1`).has('day'), false);
  assert.equal(parsePhpQuery(new URLSearchParams('day%00x=1')).get('day'), '1');
});

test('parsePhpJson rejects what PHP json_decode rejects', () => {
  assert.equal(parsePhpJson('{"a":"\\ud800"}'), null);
  assert.equal(parsePhpJson('{"\\u0000a":1}'), null);
  assert.equal(parsePhpJson('"\u0001"'), null);
  assert.equal(parsePhpJson('\uFEFF{}'), null);
  assert.equal(parsePhpJson(''), null);
  assert.equal(parsePhpJson('['.repeat(513) + ']'.repeat(513)), null);
  assert.ok(parsePhpJson('['.repeat(512) + ']'.repeat(512)));
  assert.equal(parsePhpJson('9223372036854775807').value, 9223372036854775807n);
  assert.equal(parsePhpJson('9223372036854775808').value, 9223372036854775808);
  assert.deepEqual([...parsePhpJson('{"b":1,"1":2,"b":3}').value.keys()], ['b', '1']);
});

test('parseXml rejects documents libxml rejects', () => {
  assert.equal(parseXml(''), null);
  assert.equal(parseXml('<a><b></a>'), null);
  assert.equal(parseXml('<a>&nbsp;</a>'), null);
  assert.equal(parseXml('<a>x</a><b/>'), null);
  assert.equal(parseXml(' <?xml version="1.0"?><a/>'), null);
  assert.equal(parseXml(new Uint8Array([0x3C, 0x61, 0x3E, 0xFF, 0x3C, 0x2F, 0x61, 0x3E])), null);
  assert.deepEqual(parseXml('<a>x&#x41;\r\n<!--c--><b/>y</a>'), { name: 'a', children: ['xA\n', { name: 'b', children: [] }, 'y'] });
});

test('missing or invalid parameters', async () => {
  assert.equal(await info(''), BAD_PARAMS);
  assert.equal(await info('day=1&month=1'), BAD_PARAMS);
  assert.equal(await info('day=&month=&year='), BAD_DATE);
  assert.equal(await info('day&month=1&year=2015'), BAD_DATE);
  assert.equal(await info('day=29&month=2&year=2015'), BAD_DATE);
  assert.equal(await info('day=1&month=1&year=0'), BAD_DATE);
  assert.equal(await info('day=1&month=1&year=32768'), BAD_DATE);
  assert.equal(await info('day=1&month=13&year=2015'), BAD_DATE);
});

test('today, yesterday and tomorrow are judged in Asia/Kolkata', async () => {
  assert.equal(await info('day=26&month=11&year=2026'), '{"success":true,"day_of_week":"Thursday","month_string":"November",'
    + '"time":true,"events":["Today is Thursday (26-November-2026)","Kept & trimmed","Before",'
    + '"Am\\u00e9lie \\/ \\u00d8 \\ud83d\\ude00 releases (French movie)","Mystery releases ( movie)"]}');
  assert.equal(await info('day=26&month=11&year=2026'),
    ok('Thursday', 'November', true, ['Today is Thursday (26-November-2026)', ...FUTURE]));
  assert.equal(await info('day=25&month=11&year=2026'), ok('Wednesday', 'November', false, PAST));
  assert.equal(await info('day=27&month=11&year=2026'), ok('Friday', 'November', true, FUTURE));
});

test('upstream URLs', async () => {
  const { fetch, urls } = fakeFetch();
  await getDateInfo({ day: '5', month: '6', year: '999' }, { now: NOW, fetch, vizgrBase: 'http://v', tmdbBase: 'http://t' });
  assert.deepEqual(urls, [
    'http://v/historical-events/search.php?begin_date=09990605&end_date=09990605&lang=en',
    'http://t/3/discover/movie?api_key=9ffaf75d2da4fc5ee98c6f4e866207bd&primary_release_date.gte=0999-06-05&primary_release_date.lte=0999-06-05&sort_by=popularity.desc',
  ]);
});

test('edge years and numeric strings', async () => {
  assert.equal(await info('day=29&month=2&year=2016'), ok('Monday', 'February', false, PAST));
  assert.equal(await info('day=1&month=1&year=1'), ok('Monday', 'January', false, PAST));
  assert.equal(await info('day=1&month=1&year=50'), ok('Saturday', 'January', true, FUTURE)); // strtotime reads 2050
  assert.equal(await info('day=31&month=12&year=9999'), ok('Friday', 'December', true, FUTURE));
  assert.equal(await info('day=1&month=1&year=10000'), ok('Saturday', 'January', false, PAST)); // 2000-01-01 10:00
  assert.equal(await info('day=31&month=12&year=32767'), ok('Sunday', 'December', false, PAST)); // strtotime false
  assert.equal(await info('day=%205&month=5abc&year=1e3'), ok('Monday', 'May', false, PAST));
  assert.equal(await info('day[]=1&month=1&year=2015'), ok('Thursday', 'January', false, PAST));
});

test('upstream failures add no events', async () => {
  const none = ok('Wednesday', 'October', false, []);
  assert.equal(await info('day=21&month=10&year=2015', { vizgr: null, tmdb: null }), none);
  assert.equal(await info('day=21&month=10&year=2015', { status: 404 }), none);
  assert.equal(await info('day=21&month=10&year=2015', { vizgr: '<result><count>0</count><event/></result>', tmdb: '{}' }), none);
  assert.equal(await info('day=21&month=10&year=2015', { vizgr: '<result><count>1</count><event/>', tmdb: '{"results":[{"title":"\\udc00"}]}' }), none);
});

test('TMDB value types convert like PHP', async () => {
  const tmdb = '{"results":{"b":{"title":12345678901234567890,"original_language":"en"},"1":{"title":true},"c":"x"}}';
  assert.equal(await info('day=21&month=10&year=2015', { vizgr: null, tmdb }),
    ok('Wednesday', 'October', false, ['1.2345678901235E+19 released (English movie)', '1 released ( movie)', ' released ( movie)']));
  // PHP 8 stops with an uncaught Error and, with error_reporting(0), echoes nothing.
  assert.equal(await info('day=21&month=10&year=2015', { vizgr: null, tmdb: '{"results":[{"title":{}}]}' }), '');
  assert.equal(await info('day=21&month=10&year=2015', { vizgr: null, tmdb: '{"results":[{"original_language":[]}]}' }), '');
});
