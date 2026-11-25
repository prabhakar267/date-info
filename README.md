# Date Info

This is a simple API which lets the user fetch, in JSON format, the events which happened or would happen on a specific date. The API takes 3 parameters: day, month and year.

It runs entirely in JavaScript and is served as a static site on GitHub Pages:

```
https://<user>.github.io/date-info/?day=21&month=10&year=2015
```

Events come from the [vizgr historical events service](http://www.vizgr.org/historical-events/) and from movies released on that date on [TMDB](https://www.themoviedb.org/). Dates are judged in Asia/Kolkata time. The original PHP version of the API is kept on the `master` branch; this version returns the same JSON for the same query.

| Parameter | Value |
|---|---|
| day | day of month in DD or D format |
| month | month in MM or M format |
| year | year in YYYY format |

* * * * 

Response

| Key | Meaning | Possible Values |
|---|---|---|
| success | It basically helps in checking whether the data is recieved or not, as of now this can be ignored since one can check the same  using the **status code** | true , false |
| message | If the **success** flag is **false**, this parameter gives the reason why the data is not recieved | string |
| day_of_week | If the **success** flag is **true**, then **day_of_week** gives the day of week on the date provided in input as a string | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| month_string | If the **success** flag is **true**, then **month_string** gives the month in the date provided in input as a string | January, February, March, April, May, June, July, August, September, October, November, December |
| time |  If the **success** flag is **true**, then **time** and the date provided in the parameters is **before** the current / present date, then this flag is set to **false** else this flag is **true** | true , false |
| events | This returns all the events on the specified date as an array if the **success** flag is **true** | JSON array |

* * * *

## Successful response

![successful response](/.github/screenshots/screencapture-localhost-date-info-date-info-php-1445448164530.png) 

* * * *

## Unsuccessful response

![unsuccessful response](/.github/screenshots/screencapture-localhost-date-info-date-info-php-1445447730540.png) 

* * * *

## How it works

* `index.html` is the page. It reads the query string, calls `getDateInfo` and shows only the JSON text.
* `js/date-info.js` is a dependency-free ES module that builds the response. It also works in Node 24: `getDateInfo(new URLSearchParams('day=21&month=10&year=2015'))` resolves to the JSON text.
* `.nojekyll` tells GitHub Pages to serve the files as they are.

To publish, enable GitHub Pages for the branch in the repository settings (source: the repository root).

## Tests

* `node --test js/date-info.test.mjs` runs the unit tests (no network).
* `node test/parity/run.mjs` compares the JavaScript with the original PHP from `master`, byte for byte, against mock upstreams. It needs PHP 8; see `test/parity/README.md`.

## Caveats

* GitHub Pages only serves static files, so the response is an HTML page whose visible text is the JSON. The JSON text is identical to the PHP API's, but the HTTP `Content-Type` is `text/html`, not `application/json`.
* The vizgr historical-events service is http-only and currently times out. A page served over https cannot call it, so in the browser it adds no events. That matches what the PHP API returns today, since its vizgr request times out too.
