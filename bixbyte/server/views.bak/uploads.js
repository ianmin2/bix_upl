$(function () {

    status("choose a file");

    var timerId;
    var g_album = $("#g_album");
    var uploadForm = $("#uploadForm");

    timerId = setInterval(checkUpload, 500);
    var prevVal = "";

    function checkUpload() {
        /* Ensure that the file field is filled */
        if ($("#userPhoto").val() !== "") {

            //If the file field has a value
            if (prevVal != "") {

                //Check to see that the current value is not equal to the previous
                if ($("#userPhoto").val() !== prevVal) {

                    //Upload the image          //clearInterval(timerId);
                    if (g_album.val().length > 4) {
                        uploadForm.submit();
                        g_album.css("color", "green");
                        prevVal = $("#userPhoto").val();
                        console.log( "Upload list: " + $("#userPhoto").val());
                    } else {
                        g_album.focus();
                        g_album.css("color", "red");
                    }


                }

                //If the previous value is empty
            } else {

                //clearInterval(timerId);
                if (g_album.val().length > 4) {
                    uploadForm.submit();
                    g_album.css("color", "green");
                    prevVal = $("#userPhoto").val();
                } else {
                    g_album.focus();
                    g_album.css("color", "red");
                }
            }




        } else {
            /* Awaiting a file upload trigger */
        }
    }

    uploadForm.submit(function () {

        /* File upload initiated */

        status('Uploading the file ... ');

        $(this).ajaxSubmit({
            error: function (xhr) {
                status('Error: ' + xhr.status);
            },
            success: function (resp) {

                if (resp.response === "SUCCESS") {
                    
                    /* Display a success message */
                    status("File upload complete");
                   
                } else {
                    status("Oops!  " + resp.data.message);
                    return;
                }

            }
        });

        //Prevent a page refresh
        return false;

    });
    
    $("#fin").on("click", function(){
        $.post('/gtel/api/done/'+$("#g_user").val()+"/"+$("#g_album").val(), {},
        function(data){
            window.location = "/";
        });
    });

    function status(message) {
        $("#status").html(message);        
    }

});