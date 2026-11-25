# Parity results

Run on 2026-11-25 (2026-11-26 in Asia/Kolkata) against `js/date-info.js` from
commit e875036, with PHP 8.6.0 (Homebrew) and Node 24.17.0.

| Run | Result |
|---|---|
| `node test/parity/run.mjs --self-test` | PASSED: PHP vs PHP 172/172 match; one flipped byte caught as exactly 1 mismatch |
| `node test/parity/run.mjs` (mock grid) | 172/172 match, 0 mismatches |
| vizgr connection refused (same run) | 2/2 match |
| `node test/parity/run.mjs --live` | 3/3 match (vizgr down on both sides, real TMDB) |

## History

The first run (port at commit 52097b8, 148-case grid) had 6 mismatches, all
5-digit years: 32767 (1 Jan and 31 Dec), 10600, 25000, 32000 (15 Jun) and
29999 (31 Dec). The port modelled `strtotime("Y-n-j")` as false for 5-digit
years whose first four digits do not read as a time, and sent the upstreams
1970-01-01. PHP 8.6 instead drops those four digits without an error and reads
the last digit plus `-n-j` as a date in 200X at midnight (`32767-1-1` is
2007-01-01). Commit e875036 implements that rule; it was checked with `php -r`
against every year 1-32767 for 7 day/month pairs and every day of 450 sampled
years.

The grid then gained 24 cases (commit 01617cc): more 5-digit years on both
sides of the time rule (12345, 10599, 19999, 24599, 24600, 30000, 32765,
32767), 29 Feb of leap 5-digit years whose 200X year is not leap (10016,
25012) or is (10020, 32764), 1-3 digit years (4, 9, 10, 68, 96, 400, 123), and
yesterday, today and tomorrow in IST written as a 2-digit year.
