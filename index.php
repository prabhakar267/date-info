<?php


header('Content-Type: application/json');
http_response_code(200);
/**
reference : http://php.net/manual/en/function.error-reporting.php
Set $error_reporting_flag to "0" when no error reporting is required
Set it to "E_ERROR | E_WARNING | E_PARSE" for runtime errors
Set it to "E_ALL" for all errors (including Notices)
**/
$error_reporting_flag = 0;
// $error_reporting_flag = E_ERROR | E_WARNING | E_PARSE;
// $error_reporting_flag = E_ALL;
error_reporting($error_reporting_flag);


date_default_timezone_set("Asia/Kolkata");
require 'inc/func.inc.php';
require 'inc/globals.inc.php';


$response = array(
    'success'       => false,
);


if (isset($_GET['day']) && isset($_GET['month']) && isset($_GET['year'])){
    $date = intval($_GET['day']);
    $month = intval($_GET['month']);
    $year = intval($_GET['year']);

    $response_array = array();

    if(checkdate($month, $date, $year) != 1){
        $response['message'] = 'Invalid Date provided';
    } else {
        $date_string = $year . '-' . $month . '-' . $date;
        $date_string_format = date('Ymd', strtotime($date_string));
        $date_string_format_2 = date('Y-m-d', strtotime($date_string));
        $date_display = $date . '-' . $MONTHS[$month] . '-' . $year;
    
        $day_index = getDay($date, $month, $year);
        $day = $DAY_OF_WEEK[$day_index];
        
        if(date('Y') == $year && date('n') == $month && date('j') == $date){
            $info = 'Today is '.$day.' (' . $date_display . ')';
            array_push($response_array, $info);
            $time_flag = true;  
        } else {
            if(strtotime(date('d-m-Y')) > strtotime($date_string))
                $time_flag = false;
            else 
                $time_flag = true;
            
            $info = 'The day on '.$date_display . ($time_flag ? " is " : " was ") . $day;
        }

        $response_array = getVizgrEvents($date_string_format, $response_array);
        $response_array = getMovieDBEvents($date_string_format_2, $response_array, $time_flag);

        $response['success']        = true;
        $response['day_of_week']    = $day;
        $response['month_string']   = $MONTHS[$month];
        $response['time']           = (bool)$time_flag;
        $response['events']         = $response_array;

    }

} else {
    $response['message'] = 'Please provide correct parameters';
}

echo json_encode($response);


// function to get the day of week using Zeller's algorithm
function getDay($day, $month, $year){
    if($month == 1 || $month == 2){
        $year--;
        $month += 10;
    } else {
        $month -= 2;
    }

    $c = floor($year/100);
    $year = $year%100;
    
    $w = ($day + floor(2.6*$month - 0.2) + $year + floor($year/4) + floor($c/4) - 2*$c)%7;
    if($w<0)
        $w+=7;

    return $w;
}

function getVizgrEvents($date_string_format, $response_array){
    $url = 'http://www.vizgr.org/historical-events/search.php?begin_date='.$date_string_format.'&end_date='.$date_string_format.'&lang=en';
    if(@$xml = simplexml_load_file($url)){
        if($xml->count>0){
            foreach ($xml->event as $event) {
                $event_detail = explode('{', $event->description); 
                $event_detail = explode('<', $event_detail[0]); 
                $event_detail = trim($event_detail[0]);
                array_push($response_array, $event_detail);
            }
        }
    }
    return $response_array;
}

function getMovieDBEvents($date, $response_array, $time_flag){
    $API_KEY = "9ffaf75d2da4fc5ee98c6f4e866207bd";
    $url = "http://api.themoviedb.org/3/discover/movie?"
        . 'api_key=' . $API_KEY
        . '&primary_release_date.gte=' . $date
        . '&primary_release_date.lte=' . $date
        . '&sort_by=popularity.desc';

    $response = (array)json_decode(file_get_contents($url));
    foreach($response['results'] as $result){
        $result_array = (array)$result;
        $language = $result_array['original_language'];
        $movie_name = $result_array['title'];
        
        $info = $movie_name . ' ' . ($time_flag ? 'releases' : "released") . ' (' . getLocaleCodeForDisplayLanguage($language) . ' movie)';
        array_push($response_array, $info);
    }

    return $response_array;
}

