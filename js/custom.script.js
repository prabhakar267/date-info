var DOMAIN_NAME = "http://csinsit.org/prabhakar/date-info/api/get-details.php";

function loadResults(day, month, year){
    var url = DOMAIN_NAME
            + "?day=" + day
            + "&month=" + month
            + "&year=" + year;
    var tasks = $('.tasks');
    
    $.ajax({
        url : url,
        success : function(data){
        	var response = JSON.parse(data),
        		flag = response.success;
            if(flag == false){
                tasks.html('<p>' + response.message + '</p>');
            } else {
                tasks.html('');
                for (var event in response.events) {
                    tasks.append('<p>' + response.events[event] + '</p>');
                }
            }
        },
        beforeSend : function(){
            tasks.css({'opacity' : 0.4});
        },
        complete : function() {
            tasks.css({'opacity' : 1.0});
        }
    });
}

$(document).ready(function(){
	$(document).on("click","#submit",function(){
		var date = $('#infonizer').val().split(" ");
		if(date != ""){
			var month = date[1].split(",")[0];
		    loadResults(date[0], getMonth(month), date[2]);
		}
	});
});

function getMonth(monthStr){
    return new Date(monthStr+'-1-01').getMonth() + 1;
}