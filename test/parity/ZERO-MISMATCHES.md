# Zero mismatches

The parity run exited 0: `js/date-info.js` returned the same bytes as the
original PHP for every case.

- Command: `node test/parity/run.mjs` (run from `/Users/prabhgup/Projects/date-info`)
- Started: 2026-11-25 14:15:45 PST (2026-11-26 03:45:45 IST)
- Code: branch `js-rewrite` at commit 94d9d16, clean working tree; PHP read from `master`
- PHP: `PHP 8.6.0 (cli) (built: Nov 17 2026 14:21:54) (NTS)`, Homebrew, `/opt/homebrew/bin/php` run with `arch -arm64`
- Node: v24.17.0
- Exit code: 0

Summary output, verbatim:

```

== grid (mock upstreams): 172/172 match, 0 mismatch(es)

== vizgr connection refused: 2/2 match, 0 mismatch(es)
```
