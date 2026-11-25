// date-info: a plain JavaScript port of index.php, the original PHP API (still on the master branch).
//
// getDateInfo(query, options) returns the exact response body the PHP API
// echoes (PHP 8 semantics), so it can run on a static host such as GitHub
// Pages. No dependencies and no build step: the same file runs in Node 24 and
// in modern browsers.

export const MONTHS = [
  null, 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DAY_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Copied from inc/func.inc.php (getLocaleCodeForDisplayLanguage).
export const LANGUAGES = Object.freeze({
  aa: 'Afar', ab: 'Abkhazian', ae: 'Avestan', af: 'Afrikaans', ak: 'Akan', am: 'Amharic',
  an: 'Aragonese', ar: 'Arabic', as: 'Assamese', av: 'Avaric', ay: 'Aymara', az: 'Azerbaijani',
  ba: 'Bashkir', be: 'Belarusian', bg: 'Bulgarian', bh: 'Bihari', bi: 'Bislama', bm: 'Bambara',
  bn: 'Bengali', bo: 'Tibetan', br: 'Breton', bs: 'Bosnian', ca: 'Catalan', ce: 'Chechen',
  ch: 'Chamorro', co: 'Corsican', cr: 'Cree', cs: 'Czech', cu: 'Church Slavic', cv: 'Chuvash',
  cy: 'Welsh', da: 'Danish', de: 'German', dv: 'Divehi', dz: 'Dzongkha', ee: 'Ewe',
  el: 'Greek', en: 'English', eo: 'Esperanto', es: 'Spanish', et: 'Estonian', eu: 'Basque',
  fa: 'Persian', ff: 'Fulah', fi: 'Finnish', fj: 'Fijian', fo: 'Faroese', fr: 'French',
  fy: 'Western Frisian', ga: 'Irish', gd: 'Scottish Gaelic', gl: 'Galician', gn: 'Guarani', gu: 'Gujarati',
  gv: 'Manx', ha: 'Hausa', he: 'Hebrew', hi: 'Hindi', ho: 'Hiri Motu', hr: 'Croatian',
  ht: 'Haitian', hu: 'Hungarian', hy: 'Armenian', hz: 'Herero',
  ia: 'Interlingua (International Auxiliary Language Association)', id: 'Indonesian',
  ie: 'Interlingue', ig: 'Igbo', ii: 'Sichuan Yi', ik: 'Inupiaq', io: 'Ido', is: 'Icelandic',
  it: 'Italian', iu: 'Inuktitut', ja: 'Japanese', jv: 'Javanese', ka: 'Georgian', kg: 'Kongo',
  ki: 'Kikuyu', kj: 'Kwanyama', kk: 'Kazakh', kl: 'Kalaallisut', km: 'Khmer', kn: 'Kannada',
  ko: 'Korean', kr: 'Kanuri', ks: 'Kashmiri', ku: 'Kurdish', kv: 'Komi', kw: 'Cornish',
  ky: 'Kirghiz', la: 'Latin', lb: 'Luxembourgish', lg: 'Ganda', li: 'Limburgish', ln: 'Lingala',
  lo: 'Lao', lt: 'Lithuanian', lu: 'Luba-Katanga', lv: 'Latvian', mg: 'Malagasy', mh: 'Marshallese',
  mi: 'Maori', mk: 'Macedonian', ml: 'Malayalam', mn: 'Mongolian', mr: 'Marathi', ms: 'Malay',
  mt: 'Maltese', my: 'Burmese', na: 'Nauru', nb: 'Norwegian Bokmal', nd: 'North Ndebele', ne: 'Nepali',
  ng: 'Ndonga', nl: 'Dutch', nn: 'Norwegian Nynorsk', no: 'Norwegian', nr: 'South Ndebele', nv: 'Navajo',
  ny: 'Chichewa', oc: 'Occitan', oj: 'Ojibwa', om: 'Oromo', or: 'Oriya', os: 'Ossetian',
  pa: 'Panjabi', pi: 'Pali', pl: 'Polish', ps: 'Pashto', pt: 'Portuguese', qu: 'Quechua',
  rm: 'Raeto-Romance', rn: 'Kirundi', ro: 'Romanian', ru: 'Russian', rw: 'Kinyarwanda', sa: 'Sanskrit',
  sc: 'Sardinian', sd: 'Sindhi', se: 'Northern Sami', sg: 'Sango', si: 'Sinhala', sk: 'Slovak',
  sl: 'Slovenian', sm: 'Samoan', sn: 'Shona', so: 'Somali', sq: 'Albanian', sr: 'Serbian',
  ss: 'Swati', st: 'Southern Sotho', su: 'Sundanese', sv: 'Swedish', sw: 'Swahili', ta: 'Tamil',
  te: 'Telugu', tg: 'Tajik', th: 'Thai', ti: 'Tigrinya', tk: 'Turkmen', tl: 'Tagalog',
  tn: 'Tswana', to: 'Tonga', tr: 'Turkish', ts: 'Tsonga', tt: 'Tatar', tw: 'Twi',
  ty: 'Tahitian', ug: 'Uighur', uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek', ve: 'Venda',
  vi: 'Vietnamese', vo: 'Volapuk', wa: 'Walloon', wo: 'Wolof', xh: 'Xhosa', yi: 'Yiddish',
  yo: 'Yoruba', za: 'Zhuang', zh: 'Chinese', zu: 'Zulu',
});

const TMDB_API_KEY = '9ffaf75d2da4fc5ee98c6f4e866207bd'; // already public in index.php
const PHP_INT_MAX = 9223372036854775807n;
const PHP_INT_MIN = -9223372036854775808n;
const MAX_INPUT_VARS = 1000; // php.ini max_input_vars
const MAX_INPUT_NESTING = 64; // php.ini max_input_nesting_level
const FETCH_TIMEOUT_MS = 60000; // php.ini default_socket_timeout

// Thrown where PHP 8 would stop with an uncaught Error. index.php sets
// error_reporting(0), so the body is then empty.
class PhpFatalError extends Error {}

// ---------------------------------------------------------------------------
// Query string -> $_GET
// ---------------------------------------------------------------------------

// PHP urldecode(): '+' is a space, %XX is a byte, a bad % stays as it is.
function phpUrlDecode(s) {
  return s.replace(/\+|%([0-9A-Fa-f]{2})/g, (m, hex) => (hex ? String.fromCharCode(parseInt(hex, 16)) : ' '));
}

// The [key, value] pairs PHP reads from a raw query string (without the '?').
function parseQueryString(qs) {
  return qs.split('&').filter((pair) => pair !== '').map((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 0) return [phpUrlDecode(pair), ''];
    return [phpUrlDecode(pair.slice(0, eq)), phpUrlDecode(pair.slice(eq + 1))];
  });
}

// Classify a key whose first '[' is at `open`, the way php_register_variable_ex
// walks "name[a][b]" groups.
function bracketKind(key, open) {
  for (let level = 1; ; level++) {
    if (level > MAX_INPUT_NESTING) return 'too-deep';
    const close = key.indexOf(']', open + 1);
    if (close < 0) return level === 1 ? 'plain' : 'array';
    if (key[close + 1] !== '[') return 'array';
    open = close + 1;
  }
}

// Build a Map that holds what PHP's $_GET would. A value is a string, or an
// array for "day[]=..." keys. Only isset() and intval() are ever applied to
// it, so an array's contents do not matter, only whether it is empty.
//
// `query` is a raw query string (no leading '?'), a URLSearchParams, or a
// plain object that already looks like $_GET (string or array values).
export function parsePhpQuery(query) {
  let entries;
  if (typeof query === 'string') entries = parseQueryString(query);
  else if (typeof URLSearchParams !== 'undefined' && query instanceof URLSearchParams) entries = [...query];
  else entries = Object.entries(query ?? {}).filter(([, v]) => v !== null && v !== undefined);

  const get = new Map();
  for (const [rawKey, value] of entries.slice(0, MAX_INPUT_VARS)) {
    // PHP reads the name as a C string, drops leading spaces and turns ' ' and
    // '.' before the first '[' into '_'.
    const key = String(rawKey).split('\0')[0].replace(/^ +/, '');
    const open = key.indexOf('[');
    const base = (open < 0 ? key : key.slice(0, open)).replace(/[ .]/g, '_');
    if (base === '') continue;

    if (open < 0) {
      get.set(base, value);
      continue;
    }
    const kind = bracketKind(key, open);
    if (kind === 'too-deep') {
      get.delete(base); // PHP drops the whole variable
    } else if (kind === 'plain') {
      // "day[x" has no ']': PHP turns the '[' into '_', so the name is never
      // day, month or year.
      get.set(`${base}_${key.slice(open + 1)}`, value);
    } else if (!Array.isArray(get.get(base))) {
      get.set(base, [value]);
    }
  }
  return get;
}

// ---------------------------------------------------------------------------
// PHP helpers
// ---------------------------------------------------------------------------

// PHP 8 intval() for the values $_GET can hold (strings and arrays). Returns a
// BigInt because PHP ints are 64-bit.
export function phpIntval(value) {
  if (Array.isArray(value)) return value.length ? 1n : 0n;
  const s = value === null || value === undefined ? '' : String(value);
  // Leading whitespace, a sign, then digits with an optional fraction and
  // exponent (PHP's numeric-string prefix). Anything after it is ignored.
  const m = /^[ \t\n\r\v\f]*([+-]?(?:[0-9]+(\.[0-9]*)?|(\.)[0-9]+)([eE][+-]?[0-9]+)?)/.exec(s);
  if (!m) return 0n;
  const [, number, fraction, leadingDot, exponent] = m;
  if (fraction === undefined && leadingDot === undefined && exponent === undefined) {
    const n = BigInt(number);
    return n > PHP_INT_MAX ? PHP_INT_MAX : n < PHP_INT_MIN ? PHP_INT_MIN : n;
  }
  // A float string: truncate toward zero, saturate, and INF becomes 0
  // (zend_dval_to_lval_cap).
  const d = Number(number);
  if (!Number.isFinite(d)) return 0n;
  if (d >= 2 ** 63) return PHP_INT_MAX;
  if (d < -(2 ** 63)) return PHP_INT_MIN;
  return BigInt(Math.trunc(d));
}

function isLeapYear(y) {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// PHP checkdate(): proleptic Gregorian, year 1..32767. Accepts numbers or BigInts.
export function checkdate(month, day, year) {
  const m = Number(month);
  const d = Number(day);
  const y = Number(year);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) && y >= 1 && y <= 32767;
}

// getDay() from index.php, copied literally (Zeller). JS % truncates toward
// zero like PHP's, and the operands here are always whole numbers.
export function getDay(day, month, year) {
  if (month === 1 || month === 2) {
    year--;
    month += 10;
  } else {
    month -= 2;
  }
  const c = Math.floor(year / 100);
  year %= 100;
  let w = (day + Math.floor(2.6 * month - 0.2) + year + Math.floor(year / 4) + Math.floor(c / 4) - 2 * c) % 7;
  if (w < 0) w += 7;
  return w;
}

// PHP trim() with its default character list " \t\n\r\0\x0B".
export function phpTrim(s) {
  return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

// The display name for a TMDB original_language code, '' when unknown (PHP
// returns null, which concatenates as '').
export function languageName(code) {
  return typeof code === 'string' && Object.hasOwn(LANGUAGES, code) ? LANGUAGES[code] : '';
}

// PHP (string) of a float with the default precision=14 (zend_gcvt).
// shortcut: JS toExponential rounds an exact tie at the 15th significant digit
// away from zero, PHP rounds it to even; only floats whose exact value ends in
// that 5 differ. Upgrade with an exact BigInt expansion if it ever matters.
export function phpFloatToString(x) {
  if (Number.isNaN(x)) return 'NAN';
  if (!Number.isFinite(x)) return x < 0 ? '-INF' : 'INF';
  const sign = x < 0 || Object.is(x, -0) ? '-' : '';
  const [mantissa, exp] = Math.abs(x).toExponential(13).split('e');
  const digits = mantissa.replace('.', '').replace(/0+$/, '') || '0';
  const decpt = x === 0 ? 1 : Number(exp) + 1; // digits are 0.DIGITS x 10^decpt
  if (decpt < -3 || decpt > 14) {
    const e = decpt - 1;
    return `${sign}${digits[0]}.${digits.slice(1) || '0'}E${e < 0 ? '-' : '+'}${Math.abs(e)}`;
  }
  if (decpt < 0) return `${sign}0.${'0'.repeat(-decpt)}${digits}`;
  const whole = decpt === 0 ? '0' : digits.slice(0, decpt).padEnd(decpt, '0');
  const fraction = digits.slice(decpt);
  return sign + (fraction ? `${whole}.${fraction}` : whole);
}

// PHP's string conversion of a decoded JSON value (see parsePhpJson).
function phpToString(v) {
  if (v === undefined || v === null || v === false) return '';
  if (v === true) return '1';
  if (typeof v === 'string') return v;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number') return phpFloatToString(v);
  if (Array.isArray(v)) return 'Array'; // PHP only warns
  throw new PhpFatalError('Object of class stdClass could not be converted to string');
}

// json_encode() with default flags: "/" is escaped, non-ASCII becomes
// lowercase \uXXXX (surrogate pairs above U+FFFF). Handles null, booleans,
// whole numbers, strings, arrays (as lists) and plain objects. Returns false
// where PHP would fail (a lone surrogate is PHP's invalid UTF-8).
export function phpJsonEncode(value) {
  if (value === null || value === undefined) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'string') return encodeJsonString(value);
  const isList = Array.isArray(value);
  const parts = [];
  for (const [k, v] of isList ? value.entries() : Object.entries(value)) {
    const encoded = phpJsonEncode(v);
    if (encoded === false) return false;
    parts.push(isList ? encoded : `${encodeJsonString(k)}:${encoded}`);
  }
  return isList ? `[${parts.join(',')}]` : `{${parts.join(',')}}`;
}

const JSON_ESCAPES = { '"': '\\"', '\\': '\\\\', '/': '\\/', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };

function encodeJsonString(s) {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if (JSON_ESCAPES[ch]) {
      out += JSON_ESCAPES[ch];
    } else if (code < 0x20 || code >= 0x80) {
      if (code >= 0xD800 && code <= 0xDFFF) {
        const next = s.charCodeAt(i + 1);
        if (code > 0xDBFF || !(next >= 0xDC00 && next <= 0xDFFF)) return false;
        out += `\\u${code.toString(16)}\\u${next.toString(16)}`;
        i++;
      } else {
        out += `\\u${code.toString(16).padStart(4, '0')}`;
      }
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}

// ---------------------------------------------------------------------------
// Dates (Asia/Kolkata, as index.php sets)
// ---------------------------------------------------------------------------

const IST = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric', day: 'numeric',
});

// Today's {y, m, d} in Asia/Kolkata.
function istToday(now) {
  const parts = Object.fromEntries(IST.formatToParts(now).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

// What PHP 8's strtotime("Y-n-j") gives for a date that passed checkdate, as
// local Asia/Kolkata {y, m, d, h, i}. It is never false for these inputs.
// From timelib's parse_date.re and PHP 8.6.0:
// - 1-2 digit years go through TIMELIB_PROCESS_YEAR: 0-69 -> 20xx, 70-99 -> 19xx.
// - 3-4 digit years are kept.
// - 5 digit years match no date format. The last digit plus "-n-j" parses as
//   the date with year 200X. If the first four digits read as a time
//   (gnunocolon: hour 10-24, minute 00-59) that becomes the time; otherwise
//   PHP 8.6 drops them without an error and the time stays midnight.
// Checked against PHP 8.6.0 for every year 1-32767 (7 day/month pairs) and
// for every day of 450 sampled years. The only differences are the minutes of
// two midnights that fall in Asia/Kolkata clock jumps (1906-01-01 00:08 and
// 1941-10-01 01:00 in PHP); the date, which is all the output uses, matches.
// timelib also rolls a day past month end (2002-02-29) and hour 24 forward.
export function strtotimeYnj(year, month, day) {
  let y = year;
  let h = 0;
  let i = 0;
  if (y < 70) y += 2000;
  else if (y < 100) y += 1900;
  else if (y >= 10000) {
    const s = String(y);
    const hour = Number(s.slice(0, 2));
    const minute = Number(s.slice(2, 4));
    if (hour <= 24 && minute <= 59) {
      h = hour;
      i = minute;
    }
    y = 2000 + Number(s[4]);
  }
  const t = new Date(0);
  t.setUTCFullYear(y, month - 1, day);
  t.setUTCHours(h, i, 0, 0);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), i: t.getUTCMinutes() };
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

// The body bytes, or null where PHP's http:// wrapper fails (network error,
// timeout, or HTTP status >= 400).
async function fetchBytes(fetchFn, url) {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status >= 400) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function decodeUtf8(bytes) {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

// ---------------------------------------------------------------------------
// XML (enough of libxml2 for simplexml_load_file on the vizgr feed)
// ---------------------------------------------------------------------------

// Decode XML bytes the way libxml picks an encoding: BOM, then the
// declaration's encoding, else UTF-8. Throws on bytes invalid in it.
function decodeXmlBytes(bytes) {
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return decodeUtf8(bytes.subarray(3));
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(2));
  const head = String.fromCharCode(...bytes.subarray(0, 200));
  const declared = /^<\?xml[^>]*?\sencoding\s*=\s*["']([A-Za-z][A-Za-z0-9._-]*)["']/.exec(head);
  const encoding = declared ? declared[1].toLowerCase() : 'utf-8';
  if (encoding === 'us-ascii' || encoding === 'ascii') {
    if (bytes.some((b) => b > 0x7F)) throw new Error('not ASCII');
  } else if (!/^(iso[-_]?8859[-_]1|latin-?1|l1)$/.test(encoding)) {
    return new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes); // throws on unknown labels
  }
  // ASCII or true Latin-1 (TextDecoder would use windows-1252 for that label).
  return Array.from(bytes, (b) => String.fromCharCode(b)).join('');
}

const XML_NAME_START = ':A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C\\u200D'
  + '\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}';
const XML_NAME = new RegExp(`[${XML_NAME_START}][${XML_NAME_START}\\-.0-9\\u00B7\\u0300-\\u036F\\u203F\\u2040]*`, 'uy');
const XML_INVALID_CHAR = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;
const XML_PREDEFINED = { lt: '<', gt: '>', amp: '&', apos: "'", quot: '"' };
const XML_MAX_DEPTH = 257; // libxml2 refuses deeper nesting without XML_PARSE_HUGE
const XML_FAIL = new Error('not well-formed');

// Parse an XML document into its root element, or null when libxml would
// reject it. An element is {name, children}; a child is an element or a
// string (text and CDATA, references decoded).
// shortcut: entities declared in a DOCTYPE are not expanded (the document is
// rejected instead), and namespace prefixes are not checked; vizgr uses neither.
export function parseXml(bytesOrText) {
  let s;
  try {
    s = typeof bytesOrText === 'string' ? bytesOrText : decodeXmlBytes(bytesOrText);
  } catch {
    return null;
  }
  s = s.replace(/\r\n?/g, '\n'); // XML end-of-line handling
  if (XML_INVALID_CHAR.test(s)) return null;
  let i = 0;

  const skipSpace = () => {
    const start = i;
    while (s[i] === ' ' || s[i] === '\t' || s[i] === '\n') i++;
    return i > start;
  };
  const readName = () => {
    XML_NAME.lastIndex = i;
    const m = XML_NAME.exec(s);
    if (!m) throw XML_FAIL;
    i += m[0].length;
    return m[0];
  };
  const readUntil = (end) => {
    const j = s.indexOf(end, i);
    if (j < 0) throw XML_FAIL;
    const body = s.slice(i, j);
    i = j + end.length;
    return body;
  };
  const decodeRefs = (raw) => raw.replace(/&(#[0-9]+|#x[0-9A-Fa-f]+|[^;&]*)(;?)/g, (all, ref, semi) => {
    if (!semi) throw XML_FAIL;
    if (ref[0] === '#') {
      const code = ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      const ch = code <= 0x10FFFF ? String.fromCodePoint(code) : '';
      if (!ch || XML_INVALID_CHAR.test(ch)) throw XML_FAIL;
      return ch;
    }
    if (!Object.hasOwn(XML_PREDEFINED, ref)) throw XML_FAIL;
    return XML_PREDEFINED[ref];
  });
  const skipDoctype = () => {
    let inSubset = false;
    for (i += '<!DOCTYPE'.length; i < s.length; i++) {
      const c = s[i];
      if (c === '"' || c === "'") {
        i = s.indexOf(c, i + 1);
        if (i < 0) throw XML_FAIL;
      } else if (c === '[') {
        inSubset = true;
      } else if (c === ']') {
        inSubset = false;
      } else if (c === '>' && !inSubset) {
        i++;
        return;
      }
    }
    throw XML_FAIL;
  };

  try {
    if (/^<\?xml[ \t\n]/.test(s)) {
      i = 5;
      readUntil('?>');
    }
    let root = null;
    let sawDoctype = false;
    const stack = [];
    while (i < s.length) {
      const parent = stack[stack.length - 1];
      if (!parent && skipSpace()) continue;
      if (s.startsWith('<!--', i)) {
        i += 4;
        const body = readUntil('-->');
        if (body.includes('--') || body.endsWith('-')) throw XML_FAIL;
        continue;
      }
      if (s.startsWith('<?', i)) {
        i += 2;
        if (readName().toLowerCase() === 'xml') throw XML_FAIL; // declaration not at the start
        readUntil('?>');
        continue;
      }
      if (!parent) {
        if (s.startsWith('<!DOCTYPE', i) && !root && !sawDoctype) {
          sawDoctype = true;
          skipDoctype();
          continue;
        }
        if (root || s[i] !== '<') throw XML_FAIL; // only one root, no text outside it
      } else if (s.startsWith('<![CDATA[', i)) {
        i += 9;
        parent.children.push(readUntil(']]>'));
        continue;
      } else if (s.startsWith('</', i)) {
        i += 2;
        const name = readName();
        skipSpace();
        if (s[i] !== '>' || name !== parent.name) throw XML_FAIL;
        i++;
        stack.pop();
        continue;
      } else if (s[i] !== '<') {
        const j = s.indexOf('<', i);
        if (j < 0) throw XML_FAIL;
        const raw = s.slice(i, j);
        if (raw.includes(']]>')) throw XML_FAIL;
        parent.children.push(decodeRefs(raw));
        i = j;
        continue;
      }

      // A start tag.
      i++;
      const el = { name: readName(), children: [] };
      const attributes = new Set();
      let selfClosing = false;
      for (;;) {
        const spaced = skipSpace();
        if (s.startsWith('/>', i)) {
          i += 2;
          selfClosing = true;
          break;
        }
        if (s[i] === '>') {
          i++;
          break;
        }
        if (!spaced) throw XML_FAIL;
        const attr = readName();
        if (attributes.has(attr)) throw XML_FAIL;
        attributes.add(attr);
        skipSpace();
        if (s[i] !== '=') throw XML_FAIL;
        i++;
        skipSpace();
        const quote = s[i];
        if (quote !== '"' && quote !== "'") throw XML_FAIL;
        i++;
        const value = readUntil(quote);
        if (value.includes('<')) throw XML_FAIL;
        decodeRefs(value);
      }
      if (parent) parent.children.push(el);
      else root = el;
      if (!selfClosing) {
        stack.push(el);
        if (stack.length > XML_MAX_DEPTH) throw XML_FAIL;
      }
    }
    return root && stack.length === 0 ? root : null;
  } catch (e) {
    if (e === XML_FAIL) return null;
    throw e;
  }
}

// SimpleXML's $el->name: child elements with that name and no prefix.
function childElements(el, name) {
  return el.children.filter((c) => typeof c === 'object' && c.name === name);
}

// SimpleXML's (string) cast: the element's own text and CDATA children only.
function ownText(el) {
  return el.children.filter((c) => typeof c === 'string').join('');
}

// ---------------------------------------------------------------------------
// JSON (PHP 8 json_decode without flags)
// ---------------------------------------------------------------------------

const JSON_MAX_DEPTH = 512;
const JSON_FAIL = new Error('json_decode failed');
const JSON_UNESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const JSON_NUMBER = /-?(?:0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/y;

// Decode JSON like PHP's json_decode($text): objects become Maps (document
// order, as stdClass keeps it), integers that fit 64 bits become BigInts,
// other numbers floats. Returns {value}, or null where PHP returns null on
// error: syntax, depth over 512, a lone UTF-16 surrogate escape, a raw
// control character in a string, or an object key starting with "\0".
export function parsePhpJson(text) {
  let i = 0;
  let depth = 0;
  const skipSpace = () => {
    while (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r') i++;
  };
  const hex4 = (at) => {
    const h = text.slice(at, at + 4);
    if (!/^[0-9A-Fa-f]{4}$/.test(h)) throw JSON_FAIL;
    return parseInt(h, 16);
  };
  const parseString = () => {
    i++; // opening quote
    let out = '';
    for (;;) {
      const c = text[i];
      if (c === undefined || c < ' ') throw JSON_FAIL;
      if (c === '"') {
        i++;
        return out;
      }
      if (c !== '\\') {
        out += c;
        i++;
      } else if (text[i + 1] === 'u') {
        const unit = hex4(i + 2);
        i += 6;
        if (unit >= 0xDC00 && unit <= 0xDFFF) throw JSON_FAIL;
        if (unit >= 0xD800 && unit <= 0xDBFF) {
          if (text[i] !== '\\' || text[i + 1] !== 'u') throw JSON_FAIL;
          const low = hex4(i + 2);
          if (low < 0xDC00 || low > 0xDFFF) throw JSON_FAIL;
          i += 6;
          out += String.fromCharCode(unit, low);
        } else {
          out += String.fromCharCode(unit);
        }
      } else if (Object.hasOwn(JSON_UNESCAPES, text[i + 1])) {
        out += JSON_UNESCAPES[text[i + 1]];
        i += 2;
      } else {
        throw JSON_FAIL;
      }
    }
  };
  const parseValue = () => {
    skipSpace();
    const c = text[i];
    if (c === '{' || c === '[') {
      if (depth >= JSON_MAX_DEPTH) throw JSON_FAIL;
      depth++;
      i++;
      const isObject = c === '{';
      const close = isObject ? '}' : ']';
      const result = isObject ? new Map() : [];
      skipSpace();
      if (text[i] === close) {
        i++;
        depth--;
        return result;
      }
      for (;;) {
        if (isObject) {
          skipSpace();
          if (text[i] !== '"') throw JSON_FAIL;
          const key = parseString();
          if (key[0] === '\0') throw JSON_FAIL; // "The decoded property name is invalid"
          skipSpace();
          if (text[i] !== ':') throw JSON_FAIL;
          i++;
          result.set(key, parseValue());
        } else {
          result.push(parseValue());
        }
        skipSpace();
        if (text[i] === ',') {
          i++;
        } else if (text[i] === close) {
          i++;
          depth--;
          return result;
        } else {
          throw JSON_FAIL;
        }
      }
    }
    if (c === '"') return parseString();
    for (const [word, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return value;
      }
    }
    JSON_NUMBER.lastIndex = i;
    const m = JSON_NUMBER.exec(text);
    if (!m) throw JSON_FAIL;
    i += m[0].length;
    if (m[1] === undefined && m[2] === undefined) {
      const n = BigInt(m[0]);
      if (n >= PHP_INT_MIN && n <= PHP_INT_MAX) return n;
    }
    return Number(m[0]);
  };

  try {
    const value = parseValue();
    skipSpace();
    if (i !== text.length) throw JSON_FAIL;
    return { value };
  } catch (e) {
    if (e === JSON_FAIL) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Upstream events
// ---------------------------------------------------------------------------

// getVizgrEvents() from index.php. Any failure adds nothing.
async function getVizgrEvents(ymd, vizgrBase, fetchFn) {
  const url = `${vizgrBase}/historical-events/search.php?begin_date=${ymd}&end_date=${ymd}&lang=en`;
  const bytes = await fetchBytes(fetchFn, url);
  const xml = bytes && parseXml(bytes);
  if (!xml) return [];
  const count = childElements(xml, 'count')[0];
  if (!count || phpIntval(ownText(count)) <= 0n) return [];
  return childElements(xml, 'event').map((event) => {
    const description = childElements(event, 'description')[0];
    const text = description ? ownText(description) : '';
    return phpTrim(text.split('{')[0].split('<')[0]);
  });
}

// getMovieDBEvents() from index.php. Any failure adds nothing; a title or
// language that PHP cannot use as a string or key throws PhpFatalError.
async function getMovieDBEvents(date, timeFlag, tmdbBase, fetchFn) {
  const url = `${tmdbBase}/3/discover/movie?`
    + `api_key=${TMDB_API_KEY}`
    + `&primary_release_date.gte=${date}`
    + `&primary_release_date.lte=${date}`
    + '&sort_by=popularity.desc';
  const bytes = await fetchBytes(fetchFn, url);
  if (!bytes) return [];
  let decoded;
  try {
    decoded = parsePhpJson(decodeUtf8(bytes)); // invalid UTF-8 is a json_decode error
  } catch {
    return [];
  }
  // (array)json_decode(...)['results'], then foreach over an array or object.
  const results = decoded && decoded.value instanceof Map ? decoded.value.get('results') : undefined;
  const list = Array.isArray(results) ? results : results instanceof Map ? [...results.values()] : [];

  return list.map((result) => {
    const fields = result instanceof Map ? result : new Map(); // (array) of a non-object has no 'title'
    const title = phpToString(fields.get('title'));
    const language = fields.get('original_language');
    if (Array.isArray(language) || language instanceof Map) {
      throw new PhpFatalError('Illegal offset type'); // PHP 8 TypeError
    }
    return `${title} ${timeFlag ? 'releases' : 'released'} (${languageName(language)} movie)`;
  });
}

// ---------------------------------------------------------------------------
// The API
// ---------------------------------------------------------------------------

// Returns the exact body index.php echoes for `query`.
export async function getDateInfo(query, options = {}) {
  const {
    vizgrBase = 'http://www.vizgr.org',
    tmdbBase = 'https://api.themoviedb.org',
    now = new Date(),
    fetch: fetchFn = globalThis.fetch,
  } = options;

  const get = parsePhpQuery(query);
  if (!(get.has('day') && get.has('month') && get.has('year'))) {
    return phpJsonEncode({ success: false, message: 'Please provide correct parameters' });
  }
  const date = phpIntval(get.get('day'));
  const month = phpIntval(get.get('month'));
  const year = phpIntval(get.get('year'));
  if (!checkdate(month, date, year)) {
    return phpJsonEncode({ success: false, message: 'Invalid Date provided' });
  }

  const d = Number(date);
  const m = Number(month);
  const y = Number(year);
  // date('Ymd', strtotime($date_string)) and date('Y-m-d', ...).
  const parsed = strtotimeYnj(y, m, d);
  const ymd = `${pad(parsed.y, 4)}${pad(parsed.m, 2)}${pad(parsed.d, 2)}`;
  const ymdDash = `${pad(parsed.y, 4)}-${pad(parsed.m, 2)}-${pad(parsed.d, 2)}`;
  const dateDisplay = `${d}-${MONTHS[m]}-${y}`;
  const day = DAY_OF_WEEK[getDay(d, m, y)];

  const events = [];
  let timeFlag;
  const today = istToday(new Date(now));
  if (today.y === y && today.m === m && today.d === d) {
    events.push(`Today is ${day} (${dateDisplay})`);
    timeFlag = true;
  } else {
    // strtotime(date('d-m-Y')) > strtotime($date_string). Midnight today is
    // compared as local time.
    const todayKey = [today.y, today.m, today.d, 0, 0];
    const dateKey = [parsed.y, parsed.m, parsed.d, parsed.h, parsed.i];
    timeFlag = !(compareKeys(todayKey, dateKey) > 0);
    // index.php builds "The day on ..." here but never adds it to the events.
  }

  let vizgrEvents;
  let tmdbEvents;
  try {
    [vizgrEvents, tmdbEvents] = await Promise.all([
      getVizgrEvents(ymd, vizgrBase, fetchFn),
      getMovieDBEvents(ymdDash, timeFlag, tmdbBase, fetchFn),
    ]);
  } catch (e) {
    if (e instanceof PhpFatalError) return '';
    throw e;
  }
  events.push(...vizgrEvents, ...tmdbEvents);

  const body = phpJsonEncode({
    success: true,
    day_of_week: day,
    month_string: MONTHS[m],
    time: timeFlag,
    events,
  });
  return body === false ? '' : body;
}

function compareKeys(a, b) {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  }
  return 0;
}
