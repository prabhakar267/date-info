// Canned upstream data for the mock server.
//
// vizgr fixtures are keyed by begin_date (YYYYMMDD), TMDB fixtures by
// primary_release_date.gte (YYYY-MM-DD). A date with no fixture gets the
// default reply, which echoes the requested date so a wrongly formatted date
// on either side shows up as a body mismatch.
//
// Each fixture is { status, contentType, body } or a special { behavior }:
//   'reset' - drop the connection without a response
//   'stall' - accept, send nothing, drop the connection after STALL_MS
//   'slow'  - wait SLOW_MS, then send `body`

export const STALL_MS = 2000;
export const SLOW_MS = 1000;

const NBSP = '\u00a0';

// Build a vizgr-style XML document. `count` is the raw <count> text (null
// leaves the element out). Each description is raw XML (already escaped);
// null leaves <description> out of that event.
function vizgrXml(count, descriptions, encoding = 'UTF-8') {
  let xml = `<?xml version="1.0" encoding="${encoding}"?>\n<result>\n`;
  if (count !== null) xml += `<count>${count}</count>\n`;
  for (const d of descriptions) {
    xml += '<event>\n<date>2015/01/01</date>\n';
    if (d !== null) xml += `<description>${d}</description>\n`;
    xml += '<lang>en</lang>\n<category1>Events</category1>\n<granularity>year</granularity>\n</event>\n';
  }
  return xml + '</result>\n';
}

const xml = (body, status = 200) => ({ status, contentType: 'text/xml; charset=UTF-8', body });
const json = (value, status = 200) => ({
  status,
  contentType: 'application/json;charset=utf-8',
  body: typeof value === 'string' ? value : JSON.stringify(value),
});

export const vizgr = {
  // several plain events
  '20150101': xml(vizgrXml(3, [
    'The euro becomes the currency of Lithuania.',
    'Mobile phone network launched {{cite news|title=x}} trailing',
    'A third event &lt;ref&gt;source&lt;/ref&gt; after ref',
  ])),
  // count=0 but an event is still listed: PHP must skip it
  '20150102': xml(vizgrXml(0, ['Listed but count is zero'])),
  // the awkward description shapes
  '20150103': xml(vizgrXml(13, [
    '{{starts with a brace}} so nothing is left',
    'Brace in the middle { rest',
    '&lt;ref&gt; starts with an escaped less-than',
    'Less-than in the middle &lt; rest {after}',
    '<![CDATA[CDATA text & more <b>bold</b> {x}]]>',
    'Entities: Tom &amp; Jerry, caf&#233;, &#x263A;, &quot;quoted&quot; &apos;apos&apos; &gt;',
    '\t\n  tabs and newlines around \n\t',
    `${NBSP}literal non-breaking spaces${NBSP}`,
    '&#160;entity non-breaking spaces&#160;',
    '\r\n\u000b vertical tab and CRLF \u000b\r\n',
    '',
    null,
    'Mixed <i>child element</i> content',
  ])),
  // HTTP 500 with a valid XML body: PHP treats it as a failed load
  '20150104': xml(vizgrXml(1, ['Should not appear: HTTP 500']), 500),
  // malformed XML
  '20150105': xml('<?xml version="1.0"?><result><count>1</count><event><description>broken</description></result>'),
  // connection dropped without a response
  '20150106': { behavior: 'reset' },
  // nothing sent, connection dropped after STALL_MS
  '20150107': { behavior: 'stall' },
  // ISO-8859-1 document with a raw 0xE9 byte
  '20150108': {
    status: 200,
    contentType: 'text/xml',
    body: Buffer.from(vizgrXml(1, ['Latin-1 caf\u00e9 and na\u00efve'], 'ISO-8859-1'), 'latin1'),
  },
  // <count> missing but events present
  '20150109': xml(vizgrXml(null, ['No count element'])),
  // slow but valid reply
  '20150110': { behavior: 'slow', ...xml(vizgrXml(1, ['Slow reply'])) },
  // future date used with the "releases" wording
  '20300615': xml(vizgrXml(2, ['Future event one', 'Future event two'])),
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

export function defaultVizgr(date) {
  return xml(vizgrXml(1, [`Default vizgr event for ${date}`]));
}

export function defaultTmdb(date) {
  return json({ page: 1, results: [{ title: `Default movie ${date}`, original_language: 'en' }] });
}

// Day/month/year triples that hit each fixture, for the query grid.
export const fixtureDates = [
  ...Object.keys(vizgr).map((k) => [Number(k.slice(6, 8)), Number(k.slice(4, 6)), Number(k.slice(0, 4))]),
];
