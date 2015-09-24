//!Import the basic modules for the upload server
//var pth = "../../node_modules/";
var bodyParser          = require("body-parser");
var express             = require("express");
var multer              = require("multer");

//!Instantiate the express app
var app                 = express();

//!Set the default server resource directory
app.use( express.static( __dirname + '/views/' ) );

//!Set up the express body-parser middleware { to access request body parameters }
app.use( bodyParser.urlencoded({extended:false}) );
app.use( bodyParser.json() );

//!Set up the express multer middleware { for easy file uploads  }
app.use( multer({}) );

//!Set up the default path handler
app.route("/").all( function( req, res){
    
    res.setHeader("content-type", "text/html");
    res.render( __dirname + "index.html" );
    
});

//!THE DONE! PATH HANDLER
app.route("/done").all( function( req, res){
    
    res.setHeader("content-type", "text/html");
    res.render( __dirname + "done.html" );
    
});

//!Expose the basic application frame as a module
module.exports = app;