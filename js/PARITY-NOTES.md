# Parity notes for js/date-info.js

The port was first written from php-src and timelib's `parse_date.re`, then checked against PHP 8.6.0 (Homebrew) with the harness in `test/parity/`. The latest run matches PHP byte for byte on every grid case (see `test/parity/RESULTS.md`).

## Edge inputs and what the port returns

`now` = 2026-11-25 21:40 UTC (2026-11-26 03:10 in Asia/Kolkata). Upstreams unreachable, so `events` holds only the "Today is" line. "Upstream date" is the date sent to vizgr and TMDB (`date('Y-m-d', strtotime("Y-n-j"))`).

| Query | Upstream date | Body |
|---|---|---|
| `(empty)` | - | `{"success":false,"message":"Please provide correct parameters"}` |
| `day=&month=&year=` | - | `{"success":false,"message":"Invalid Date provided"}` |
| `day&month=1&year=2015` | - | `{"success":false,"message":"Invalid Date provided"}` |
| `day=25&month=11&year=2026` | 2026-11-25 | `{"success":true,"day_of_week":"Wednesday","month_string":"November","time":false,"events":[]}` |
| `day=26&month=11&year=2026` | 2026-11-26 | `{"success":true,"day_of_week":"Thursday","month_string":"November","time":true,"events":["Today is Thursday (26-November-2026)"]}` |
| `day=27&month=11&year=2026` | 2026-11-27 | `{"success":true,"day_of_week":"Friday","month_string":"November","time":true,"events":[]}` |
| `day=29&month=2&year=2016` | 2016-02-29 | `{"success":true,"day_of_week":"Monday","month_string":"February","time":false,"events":[]}` |
| `day=29&month=2&year=2015` | - | `{"success":false,"message":"Invalid Date provided"}` |
| `day=29&month=2&year=1900` | - | `{"success":false,"message":"Invalid Date provided"}` |
| `day=29&month=2&year=2000` | 2000-02-29 | `{"success":true,"day_of_week":"Tuesday","month_string":"February","time":false,"events":[]}` |
| `day=1&month=1&year=1` | 2001-01-01 | `{"success":true,"day_of_week":"Monday","month_string":"January","time":false,"events":[]}` |
| `day=1&month=1&year=50` | 2050-01-01 | `{"success":true,"day_of_week":"Saturday","month_string":"January","time":true,"events":[]}` |
| `day=31&month=12&year=999` | 0999-12-31 | `{"success":true,"day_of_week":"Tuesday","month_string":"December","time":false,"events":[]}` |
| `day=1&month=1&year=1000` | 1000-01-01 | `{"success":true,"day_of_week":"Wednesday","month_string":"January","time":false,"events":[]}` |
| `day=31&month=12&year=9999` | 9999-12-31 | `{"success":true,"day_of_week":"Friday","month_string":"December","time":true,"events":[]}` |
| `day=1&month=1&year=10000` | 2000-01-01 | `{"success":true,"day_of_week":"Saturday","month_string":"January","time":false,"events":[]}` |
| `day=1&month=1&year=24000` | 2000-01-02 | `{"success":true,"day_of_week":"Saturday","month_string":"January","time":false,"events":[]}` |
| `day=1&month=1&year=10600` | 2000-01-01 | `{"success":true,"day_of_week":"Wednesday","month_string":"January","time":false,"events":[]}` |
| `day=31&month=12&year=32767` | 2007-12-31 | `{"success":true,"day_of_week":"Sunday","month_string":"December","time":false,"events":[]}` |
| `day=1&month=1&year=32768` | - | `{"success":false,"message":"Invalid Date provided"}` |
| `day=%205&month=1&year=2015` | 2015-01-05 | `{"success":true,"day_of_week":"Monday","month_string":"January","time":false,"events":[]}` |
| `day=5abc&month=1&year=2015` | 2015-01-05 | `{"success":true,"day_of_week":"Monday","month_string":"January","time":false,"events":[]}` |
| `day=1e1&month=1&year=2015` | 2015-01-10 | `{"success":true,"day_of_week":"Saturday","month_string":"January","time":false,"events":[]}` |
| `day[]=1&month=1&year=2015` | 2015-01-01 | `{"success":true,"day_of_week":"Thursday","month_string":"January","time":false,"events":[]}` |
| `day=1&day=2&month=1&year=2015` | 2015-01-02 | `{"success":true,"day_of_week":"Friday","month_string":"January","time":false,"events":[]}` |

Upstream-shape cases, covered in `js/date-info.test.mjs`:

* Non-ASCII and "/" in a TMDB title: `Amélie / Ø 😀` is encoded as `Am\u00e9lie \/ \u00d8 \ud83d\ude00`.
* Unknown language code `xx`: `Mystery released ( movie)`.
* A TMDB title that is a JSON object, or an `original_language` that is an array or object: PHP 8 throws an uncaught Error and, with `error_reporting(0)`, the body is empty. The port returns `""`.
* Numeric or boolean titles: `12345678901234567890` becomes `1.2345678901235E+19` (float, precision 14), `true` becomes `1`, a missing title becomes `""`.
* `results` as a JSON object is iterated in document order (PHP's `foreach` over stdClass).
* TMDB JSON with a lone `\udc00` escape, a key starting with `\u0000`, invalid UTF-8, a BOM, or nesting over 512: `json_decode` returns null, so no TMDB events.
* HTTP status >= 400, network error or 60 s timeout on either upstream: no events from it.
* Vizgr `<count>` missing or `<= 0` (read with PHP intval): no vizgr events. An `<event>` without `<description>` adds `""`.
* Vizgr description: only the element's own text and CDATA (child elements are skipped), cut at the first `{`, then at the first `<`, then PHP-trimmed.

## Decisions worth checking

* strtotime("Y-n-j"), from timelib `parse_date.re`:
  * Years 1-69 are read as 2001-2069 and 70-99 as 1970-1999 (TIMELIB_PROCESS_YEAR on the 1-4 digit `year` of `gnudateshort`). So `year=50` queries the upstreams for 2050 and gives `time:true`, while `year=1` queries 2001.
  * 3-4 digit years are kept; date('Y') pads to 4 digits (`0999`).
  * 5-digit years match no date rule. The last digit plus `-n-j` is always read as the date in 200X. When the first four digits read as a time (`gnunocolon`: hour 10-24, minute 00-59), they become the time (`10000-1-1` is 2000-01-01 10:00, `24000-1-1` is 2000-01-02 00:00, `10012-2-29` rolls to 2002-03-01 10:01). Otherwise PHP 8.6 drops them with no error and the time stays midnight (`32767-1-1` is 2007-01-01, `10600-1-1` is 2000-01-01). strtotime never returns false for a date that passed checkdate.
  * Checked with `php -r` on PHP 8.6.0: every year 1-32767 for 7 day/month pairs, and every day of 450 sampled years (1-130, 990-1010, 1960-2080, 9990-10020, every 53rd year from 10000, and the boundary years). The only differences from the port are two midnights inside Asia/Kolkata clock jumps, where PHP moves the time forward (1906-01-01 00:08, 1941-10-01 01:00). The date is unchanged, and only the date reaches the output.
* `intval` on a float string saturates at PHP_INT_MAX/MIN and gives 0 for INF (`zend_dval_to_lval_cap`). It cannot change the output, since only 1..32767 passes checkdate.
* `$_GET` parsing: duplicates keep the last value, `day[]`/`day[x]` make an array (intval 1), a later plain `day=` replaces the array, leading spaces in names are dropped, `.` and ` ` become `_`, a name is cut at `%00`, more than 64 bracket levels drop the variable, and only the first 1000 pairs are read (max_input_vars).
* The vizgr and TMDB requests run in parallel. PHP runs them one after the other; the output is the same.

## Not checked against PHP

The harness grid does not cover these, so they still rest on reading the source:

* max_input_vars: that PHP stops reading the query after 1000 pairs.
* XML edge cases: libxml's exact depth limit (port fails above 257 levels), entities declared in a DOCTYPE (the port rejects the document; libxml would expand them), and non-UTF-8 encodings other than ISO-8859-1/ASCII (decoded with TextDecoder).
* Float-to-string ties: JS rounds an exact tie at the 15th significant digit away from zero, PHP rounds it to even.
* JSON nesting deeper than 512 levels in a TMDB reply.
