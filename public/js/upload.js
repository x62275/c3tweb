$(function () {
    status('Select a file to upload.');
    var timerId;

    function setTimer() {
        timerId = setInterval(function () {
            if ($('#userFileInput').val() !== '') {
                clearInterval(timerId);
                $('#uploadForm').submit();
            }
        }, 500);
    }

    function setProgress(percent) {
        $('#percent').html(percent + '%');
        $('#bar').css('width', percent + '%');
    }

    function rounding(num){
        return Math.round(num*100)/100;
    }

    setTimer();
    $('#uploadForm').submit(function () {
        status('Uploading...');
        var formData = new FormData();
        var file = document.getElementById('userFileInput').files[0];
        formData.append('userFile', file);
        var xhr = new XMLHttpRequest();
        xhr.overrideMimeType('application/json');
        xhr.open('post', '/api/upload', true);
        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable){
                setProgress(Math.round((e.loaded / e.total) * 100));
                var totalMB = rounding(e.total / 1048576);
                var remainingMB = rounding((e.total - e.loaded) / 1048576);
                status("Remaining upload: " + remainingMB + " MB");
            };
        };
        xhr.onerror = function (e) {
            status('error while trying to upload');
        };
        xhr.onload = function () {
            $('#userFileInput').val('');
            setProgress(0);
            var resJson = JSON.parse(xhr.responseText);
            status(resJson.file + ' uploaded successfully. Please select another file.');
            setTimer();
            console.log(resJson.file + " saved as " + resJson.savedAs);
        };
        xhr.send(formData);
        return false; // no refresh
    });
    function status(message) {
        $('#status').text(message);
    }
});