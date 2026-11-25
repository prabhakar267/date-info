# PHP vs JS parity harness

Checks that `js/date-info.js` returns exactly the bytes the original PHP API
echoes, for the same query, the same upstream data and the same moment.

## Run

```sh
node test/parity/run.mjs
```

Exit code 0 means every case matched, 1 means at least one mismatch (each is
printed with both bodies and the first differing byte), 2 means the harness
itself failed.

Other modes:

| Command | What it does |
|---|---|
| `node test/parity/run.mjs --self-test` | PHP vs PHP (must be 0 mismatches), then PHP vs PHP with one byte flipped in one case (must be exactly 1 mismatch). Proves the harness compares and catches a one-byte difference. Does not need the JS port. |
| `node test/parity/run.mjs --live` | Three dates (today in IST, 2015-01-01, 2019-04-26) against the real upstreams from both sides. vizgr is down, so both sides wait out its timeout (about 60 s per PHP request) and return no vizgr events. Takes about 3.5 minutes. TMDB results can change between the two calls, so a rare live mismatch may be upstream drift. |
| `PARITY_IMPL=<file> node test/parity/run.mjs` | Test another module that exports `getDateInfo` instead of `js/date-info.js`. |

Needs Node 24 and PHP 8 (`arch -arm64 brew install php`; the runner uses
`/opt/homebrew/bin/php`, or `PHP_BIN` if set). No npm packages.

## How it works

- `php-runner.mjs` reads `index.php`, `inc/func.inc.php` and
  `inc/globals.inc.php` from the `master` branch with `git show`, so it works
  after the PHP files are removed from the working branch. It writes them to a
  temp dir, replaces `http://www.vizgr.org` and `http://api.themoviedb.org`
  with the mock server's URLs (each must occur exactly once), and serves the
  copy with one `php -S 127.0.0.1:<port>` process. Queries are sent byte for
  byte, without URL normalisation. PHP's execution and input time limits are
  turned off (`-d max_execution_time=0 -d max_input_time=-1`): with php.ini's
  limits, PHP 8.6's built-in server on macOS kills a request that waits out a
  dead vizgr with a fatal error and an empty body, which is a hosting setting
  rather than API behaviour.
- `mock-server.mjs` is a plain `node:http` server on 127.0.0.1 serving
  `fixtures.mjs`: vizgr XML keyed by `begin_date`, TMDB JSON keyed by
  `primary_release_date.gte`. A date without a fixture gets one default event
  and one default movie that echo the requested date. It logs every request.
- `run.mjs` sends each query to PHP, then calls
  `getDateInfo(new URLSearchParams(query), { vizgrBase, tmdbBase, now, fetch })`
  with `now` taken just before the PHP request. A case is retried once if the
  IST day changed during it. A case fails if the bodies differ by any byte, or
  if the two sides asked the upstreams for different things (path and query
  parameters compared, ignoring parameter order and call order).
- All servers are stopped and the temp dir is removed when the run ends.

## What the grid covers (172 cases with the mock, plus 2 with vizgr refused)

- Missing `day`, `month` or `year`, no parameters, unrelated parameters.
- Empty values, and `day` with no `=`.
- Yesterday, today and tomorrow in Asia/Kolkata, today zero-padded, and the
  same day and month in the previous and next year.
- 29 Feb in 2015, 2016, 1900, 2000 and 2024; 30 Feb; 31 Apr; day 0 and 32;
  month 0 and 13; 4 and 15 Oct 1582; 31 Dec 1969; 19 Jan 2038.
- Jan 1 and Dec 31 of years 0, 1, 50, 69, 70, 99, 100, 999, 1000, 1582,
  1900, 1970, 9999, 10000, 32767, 32768, and other 5-digit years (10600,
  20000, 24000, 25000, 10012-02-29, 23599, 32000, 29999, 12345, 10599, 19999,
  24599, 24600, 30000, 32765, 29 Feb of 10016, 10020, 25012 and 32764), which
  strtotime reads in unusual ways.
- 1-3 digit years (4, 9, 10, 68, 96, 400, 123), and yesterday, today and
  tomorrow in IST written as a 2-digit year (strtotime reads them as 20xx).
- For each of `day`, `month` and `year`: `" 5"`, `"5abc"`, `"+5"` (encoded
  and raw `+`), `"-5"`, `"1e1"`, `"1.9"`, `"0x1A"`, `"05"`, leading tab,
  trailing space, a 20-digit number, `"abc"`; plus year forms such as
  `"2.015e3"` and `"0x7DF"`.
- Duplicate keys, `day[]=1`, `day[a]=3`, mixed scalar and array keys,
  URL-encoded values and keys, an encoded `&`, `;` as a separator, a
  non-ASCII extra parameter.
- Every fixture date:

| Date | vizgr | TMDB |
|---|---|---|
| 2015-01-01 | several events, `{{...}}` and `&lt;ref&gt;` cut-offs | titles with `/`, quotes, backslashes, accents, CJK, an emoji, tab and newline; unknown, upper-case, missing and null `original_language`; missing title |
| 2015-01-02 | `count` 0 with an event listed | empty `results` |
| 2015-01-03 | descriptions starting with `{` or `<`, CDATA, `&amp; &lt; &#233;` and other entities, tabs/newlines/CRLF and non-breaking spaces (literal and `&#160;`) around the text, empty and missing description, a child element | no `results` key |
| 2015-01-04 | HTTP 500 with a valid body | HTTP 500 with a valid body |
| 2015-01-05 | malformed XML | invalid JSON |
| 2015-01-06 | connection dropped with no response | `results: null` |
| 2015-01-07 | no response, connection dropped after 2 s (timeout) | default |
| 2015-01-08 | ISO-8859-1 document | default |
| 2015-01-09 | no `count` element | default |
| 2015-01-10 | valid reply after 1 s | default |
| 2030-06-15 | two future events | two future movies (`releases` wording) |

- vizgr connection refused (PHP re-served with vizgr pointed at a closed
  port), for 2015-01-01 and today.

Not covered: a vizgr wait longer than PHP's 60 s socket timeout against the
mock (the `--live` run covers it against the real dead host), and response
headers or status codes (the port returns the body only).

Results of the latest run against the port are in `RESULTS.md`.
