function getScore() {
    var id = $(".subbox").text();
    $.ajax({
        url: "/api/getscores",
        dataType: "json",
        data: {eventid: id},
        method: "POST"
    }).done(function (data) {
        $("#score").html(''+data['userscore']);
    });
}

$("form#subform").submit(function(e) {
    $.ajax({
        type: "POST",
        url: "/api/submit",
        data: $("form#subform").serialize(),
        dataType: "JSON",
        success: function(data) {
            var status = $("#status");
            var msg = ' Nope...';
            status.empty(); status.show();
            if (data.status=="success") {
                msg = ' Correct!'
                $("form#subform").fadeOut(1500);
                setTimeout(getChallenges( $(".subbox").text() ), 2000);
                getScore();
            };
            status.append(msg).fadeOut(1500);
        }
    });
    e.preventDefault();
});

function getAdminsByEvent(id) {
    $.ajax({
        url: "/api/events/admins",
        dataType: "json",
        method: "POST",
        data: {eventid: id}
    }).done(function (data) {
        var a = $("#admins");
        a.append('Admins: ');
        data.forEach(function (entry) {
            a.append(entry.username+' ');
        });
        a.append('<br><br>');
    });
}

function generateChalbox(id,n,d) {
    var subform = $("form#subform");
    subform.empty();
    var s = n+": <input type = 'text' name = 'submission'><input type = 'hidden' name = 'chalid' value = "+id+"><input type = 'submit'></form><br>";
    subform.append(s);
    subform.append(d);
    subform.show();
}

function getChallenges(id) {
    var events = $("#events");
    var back = $("#back");
    events.empty();
    back.empty();
    $("#scorebox").html('Score: <div id = "score"> </div>');
    var s = '<div class = "subbox" style="display:none">'+id+'</div>';
    s += '<table id = "challengeTable"  class = "table table-striped">';
    s += '<tr>';
    s += '<td>Challenge Name</td>';
    s += '<td>Category</td>';
    s += '<td>Value</td>';
    s += '</tr>';
    s += '</table>';
    s += '<div id = "admins"></div>';
    events.append(s);
    getScore();
    $.ajax({
        url: "/api/challenges",
        dataType: "json",
        method: "POST",
        data: {eventid: id}
    }).done(function (data) {
        data.forEach(function (entry) {
            var s = '<tr><td><div id = "subtoggle" onclick = \'generateChalbox('+entry.id+', "'+entry.name+'", "'+entry.description+'")\'>'+entry.name+'</div></td>';
            s+= '<td>'+entry.category+'</td>';
            s+= '<td>'+entry.value+'</td></tr>';
            $("#challengeTable").append(s);
        });
    });

    getAdminsByEvent(id);

    back.append("<div id = 'getEvents' onclick = 'getEvents()'>Back</div>");
}

function getEvents() {
    var events = $("#events");
    events.empty();
    $("form#subform").empty();
    $("#scorebox").empty();
    var s = '<table id = "eventTable"  class = "table table-striped">';
    s += '<tr>';
    s += '<td>Event Name</td>';
    s += '<td>Start</td>';
    s += '<td>End</td>';
    s += '<td>Go!</td>';
    s += '</tr>';
    s += '</table>';
    events.append(s);

    $.ajax({
        url: "/api/events",
        dataType: "json"
    }).done(function (data) {
        data.forEach(function (entry) {
            var s = '<tr><td>'+entry.name+'</td>';
            s+= '<td>'+entry.start+'</td>';
            s+= '<td>'+entry.end+'</td>';
            s+= '<td><div class = "thisbutton" onclick="getChallenges('+entry.id+')"> Click me! </div></td></tr>';
            $("#eventTable").append(s);
        });
    });
}

getEvents();