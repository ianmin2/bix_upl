var mandrill    = require("mandrill-api/mandrill");
var mandrill_client     = new mandrill.Mandrill("bTzP6ZlUlI55jRcyXAolzw");
var c   	    = require("colors");

c.setTheme({  
      success:  'green',
      err:      'red',
      info:     'blue'
});

var emails = [{
                        "email": "0700101108@safaricom.com",
                        "type": "to"
             }];

var message = {
        "subject": "Hello There!",
        "from_email": "0711808468@safaricom.com",
        "to": emails,
        "important": true,
        "track_opens": true
    };

    mandrill_client.messages.send({
        "message": message,
        "async": false
    }, function (result) {
        console.log("Email sending result:\n".success + JSON.stringify(result));
    }, function (e) {
        console.log('Error while trying to send email:\n'.err + e.name + ' - '.err + e.message);        
    });


