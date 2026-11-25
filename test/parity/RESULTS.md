# Parity results

Run on 2026-11-25 (2026-11-26 in Asia/Kolkata) against `js/date-info.js` from
commit 52097b8, with PHP 8.6.0 (Homebrew) and Node 24.17.0.

| Run | Result |
|---|---|
| `node test/parity/run.mjs --self-test` | PASSED: PHP vs PHP 148/148 match; one flipped byte caught as exactly 1 mismatch |
| `node test/parity/run.mjs` (mock grid) | 142/148 match, **6 mismatches** |
| vizgr connection refused (same run) | 2/2 match |
| `node test/parity/run.mjs --live` | 3/3 match (vizgr down on both sides, real TMDB) |

## Mismatches

All six are 5-digit years. The JS port sends the upstreams 1970-01-01 (its
model of `strtotime()` returning false), while PHP 8.6's `strtotime("Y-n-j")`
returns a real date. Only the upstream date differs, so `events` differ;
`day_of_week`, `month_string` and `time` match.

| Query | PHP upstream date | JS upstream date |
|---|---|---|
| `day=1&month=1&year=32767` | 2007-01-01 | 1970-01-01 |
| `day=31&month=12&year=32767` | 2007-12-31 | 1970-01-01 |
| `day=1&month=1&year=10600` | 2000-01-01 | 1970-01-01 |
| `day=1&month=1&year=25000` | 2000-01-01 | 1970-01-01 |
| `day=15&month=6&year=32000` | 2000-06-15 | 1970-01-01 |
| `day=31&month=12&year=29999` | 2009-12-31 | 1970-01-01 |

PHP 8.6 `date_parse()` reports no error for these. It drops the first four
digits and reads the last digit plus `-n-j` as a date in 200X, with no time
set (`date_parse("10600-1-1")` gives 2000-01-01 and hour false). The cases the
port already matches are those where the first four digits read as a time
(10000, 20000, 24000, 23599, 10012-02-29).

Example body diff (`day=1&month=1&year=32767`, first differing byte 112):

```
PHP: {"success":true,"day_of_week":"Sunday","month_string":"January","time":false,"events":["Default vizgr event for 20070101","Default movie 2007-01-01 released (English movie)"]}
JS : {"success":true,"day_of_week":"Sunday","month_string":"January","time":false,"events":["Default vizgr event for 19700101","Default movie 1970-01-01 released (English movie)"]}
```

The harness also reports that the upstream requests differ for these cases
(`begin_date=20070101` vs `19700101`, and the same for TMDB). Every other case
made identical upstream requests on both sides.
