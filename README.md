# Date Info

A small API that returns, as JSON, what happened (or will happen) on a given date: the day of the week, historical events from that exact date, and movies released that day.

It runs entirely in JavaScript as a static site on GitHub Pages:

```
https://www.prabhakargupta.com/date-info/?day=D&month=M&year=Y
```

For example [https://www.prabhakargupta.com/date-info/?day=20&month=7&year=1969](https://www.prabhakargupta.com/date-info/?day=20&month=7&year=1969).

The original PHP version of the API is kept on the `master` branch. This version returns the same JSON for the same query, except that historical events now come from Wikipedia (see below).

## Parameters

| Parameter | Value |
|---|---|
| day | day of the month, `D` or `DD` |
| month | month, `M` or `MM` |
| year | year, `YYYY` |

All three are required.

## Response

| Key | Present when | Meaning |
|---|---|---|
| success | always | `true` if the date was read, `false` otherwise |
| message | `success` is `false` | `Please provide correct parameters` when `day`, `month` or `year` is missing; `Invalid Date provided` when the date does not exist |
| day_of_week | `success` is `true` | `Monday` ... `Sunday` |
| month_string | `success` is `true` | `January` ... `December` |
| time | `success` is `true` | `false` if the date is before today, `true` if it is today or later |
| events | `success` is `true` | array of strings, described below |

The `events` array holds, in order:

1. `Today is <weekday> (<D-Month-YYYY>)`, only when the date is today.
2. Historical events from Wikipedia's On this day feed (`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/MM/DD`). The feed lists events from every year for a day and month; only those from the requested year are kept, in the feed's order.
3. Movies released that day on [TMDB](https://www.themoviedb.org/), most popular first, as `<title> released (<language> movie)`, or `releases` for today and future dates.

"Today" is judged in Asia/Kolkata time, as the PHP API did.

Example, `?day=20&month=7&year=1969` (TMDB lines shortened):

```
{"success":true,"day_of_week":"Sunday","month_string":"July","time":false,"events":["Apollo program: Apollo 11's crew successfully makes the first human landing on the Moon in the Sea of Tranquility. Americans Neil Armstrong and Buzz Aldrin become the first humans to walk on the Moon six and a half hours later.","A cease fire is announced between Honduras and El Salvador, six days after the beginning of the \"Football War\".","Flying Phantom Ship released (Japanese movie)", ...]}
```

Errors:

```
{"success":false,"message":"Please provide correct parameters"}
{"success":false,"message":"Invalid Date provided"}
```

The JSON is encoded the way PHP's `json_encode` does it: `/` is written as `\/` and non-ASCII characters as `\uXXXX`.

## How it works

* `index.html` is the page. It reads the query string, calls `getDateInfo` and shows only the JSON text.
* `js/date-info.js` is a dependency-free ES module that builds the response. It also runs in Node 24: `getDateInfo(new URLSearchParams('day=20&month=7&year=1969'))` resolves to the JSON text. Options `wikiBase`, `tmdbBase`, `now` and `fetch` replace the upstreams and the clock, for tests.
* `.nojekyll` tells GitHub Pages to serve the files as they are.

To publish, enable GitHub Pages for the branch in the repository settings (source: the repository root).

## Tests

```
node --test js/date-info.test.mjs
```

Runs the unit tests with Node 24. They use a fake `fetch`, so they need no network.

## Caveats

* GitHub Pages only serves static files, so the response is an HTML page whose visible text is the JSON. The HTTP `Content-Type` is `text/html`, not `application/json`.
* Many dates have no Wikipedia events in that exact year, so `events` often holds only movies, or nothing.
* If Wikipedia or TMDB fails (network error, non-200 status, bad JSON), that source adds no events and the rest of the response is unchanged.
* Years are read the way PHP's `strtotime` reads them: a 1-2 digit year means 2001-2069 or 1970-1999 for the events and the `time` flag, and a 5-digit year maps to a date around 2000-2010.
