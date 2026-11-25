// Canned upstream data for the mock server.
//
// The PHP side still asks vizgr for events and the JS side asks Wikipedia, so
// the two are compared like for like: vizgr always answers with no events, and
// every Wikipedia reply yields no events for the grid's dates (a failure, or
// events from year 0 or earlier, which the port filters out). Wikipedia
// fixtures are keyed by MM/DD, TMDB fixtures by primary_release_date.gte
// (YYYY-MM-DD). A date with no fixture gets the default reply, which echoes
// the requested date so a wrongly formatted date shows up as a mismatch.
//
// Each fixture is { status, contentType, body } or a special { behavior }:
//   'reset' - drop the connection without a response
//   'stall' - accept, send nothing, drop the connection after STALL_MS
//   'slow'  - wait SLOW_MS, then send `body`

export const STALL_MS = 2000;
export const SLOW_MS = 1000;

const xml = (body, status = 200) => ({ status, contentType: 'text/xml; charset=UTF-8', body });
const json = (value, status = 200) => ({
  status,
  contentType: 'application/json;charset=utf-8',
  body: typeof value === 'string' ? value : JSON.stringify(value),
});

// What PHP's vizgr call sees for every date: a valid reply with no events.
export const vizgrNoEvents = xml('<?xml version="1.0" encoding="UTF-8"?>\n<result>\n<count>0</count>\n</result>\n');

// Events from years no grid date maps to (strtotime always gives year >= 1).
const otherYears = (mmdd) => [
  { text: `Year 0 event for ${mmdd}`, year: 0, pages: [] },
  { text: `BC event for ${mmdd}`, year: -44, pages: [] },
];

export const wiki = {
  // events present but in the wrong shape
  '01/03': json({ events: null }),
  // HTTP 500 with an event for 2015: the port must ignore the body
  '01/04': json({ events: [{ text: 'Should not appear: HTTP 500', year: 2015, pages: [] }] }, 500),
  // malformed JSON
  '01/05': json('{"events": [ {"text": "broken"'),
  // connection dropped without a response
  '01/06': { behavior: 'reset' },
  // nothing sent, connection dropped after STALL_MS
  '01/07': { behavior: 'stall' },
  // year as a string is not the year
  '01/08': json({ events: [{ text: 'String year', year: '2015', pages: [] }] }),
  // no events key
  '01/09': json({}),
  // slow but valid reply
  '01/10': { behavior: 'slow', ...json({ events: otherYears('01/10') }) },
};

export const tmdb = {
  // awkward titles and languages
  '2015-01-01': json({
    page: 1,
    results: [
      { title: 'AC/DC: Live / Unplugged', original_language: 'en' },
      { title: 'He said "hi" and \'bye\'', original_language: 'fr' },
      { title: 'Back\\slash \\n not a newline', original_language: 'de' },
      { title: 'Amélie à Paris, Ñandú, Ørsted', original_language: 'es' },
      { title: '千と千尋の神隠し', original_language: 'ja' },
      { title: '你好 世界', original_language: 'zh' },
      { title: 'Rocket 🚀 Movie', original_language: 'ko' },
      { title: 'Unknown language', original_language: 'xx' },
      { title: 'Upper-case code', original_language: 'EN' },
      { title: 'Missing language' },
      { title: 'Null language', original_language: null },
      { original_language: 'en' },
      { title: 'Tab\tand\nnewline', original_language: 'hi' },
    ],
  }),
  '2015-01-02': json({ page: 1, results: [] }),
  '2015-01-03': json({ page: 1, total_results: 0 }),
  // HTTP 500 with a valid JSON body: PHP's file_get_contents returns false
  '2015-01-04': json({ results: [{ title: 'Should not appear: HTTP 500', original_language: 'en' }] }, 500),
  '2015-01-05': json('{"results": [ {"title": "broken"'),
  '2015-01-06': json({ page: 1, results: null }),
  '2030-06-15': json({
    page: 1,
    results: [
      { title: 'Future Film', original_language: 'en' },
      { title: 'Film Futur', original_language: 'fr' },
    ],
  }),
};

export function defaultWiki(mmdd) {
  return json({ events: otherYears(mmdd) });
}

export function defaultTmdb(date) {
  return json({ page: 1, results: [{ title: `Default movie ${date}`, original_language: 'en' }] });
}

// Day/month/year triples that hit each fixture, for the query grid.
export const fixtureDates = [
  [1, 1, 2015], [2, 1, 2015], [3, 1, 2015], [4, 1, 2015], [5, 1, 2015], [6, 1, 2015],
  [7, 1, 2015], [8, 1, 2015], [9, 1, 2015], [10, 1, 2015], [15, 6, 2030],
];
