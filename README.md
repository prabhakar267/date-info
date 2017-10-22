# Date Info

This is a simple API which let's the user fetch the events in JSON format which happened or would happen on a specific date. API takes 3 parameters as day in date, month and year format.

| Parameter | Value |
|---|---|
| day | day of month in DD or D format |
| month | month in MM or M format |
| year | year in YYYY format |

* * * * 

Response

| Key | Meaning | Possible Values |
|---|---|---|
| status_code | It gives the status of the data recieved by the user. If the data is correctly provided, then status code is **200** else it is **400** along with the **message**  | 200 , 400 |
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
