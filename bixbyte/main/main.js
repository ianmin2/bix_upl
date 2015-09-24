//!The main configuration file
var bixdata = {};

//!Specify whether on production or development mode
bixdata.mode = "development";

//!Set the administrator email adress(es)
bixdata.adminmail = [{
                        "email": "ianmin2@live.com",
                        "name": "Ian Innocent Mbae",
                        "type": "to"
                     }];

//!Set the user email adress(es)
bixdata.usermail = [{
                        "email": "ianmin2@live.com",
                        "name": "Ian Innocent Mbae",
                        "type": "to"
                     }/*,{
                        "email": "kituaemil@hotmail.com",
                        "name": "Kitua Emil",
                        "type": "cc"
                     }*/];

//!The Standard formatter for things b!xbyte
bixdata.makeResponse = function (response, message, command) {
    return {
        response: response.toUpperCase(),
        data: {
            message: message,
            command: command
        }
    };
};

//!The string sanitiser
bixdata.sanitize = function (title) {
                        title = title.replace(/'/g, "");
                        //title = escape(title)
                        return title
                    };

//!Expose the module object and it's components
module.exports = bixdata;