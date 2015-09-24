//var pth         = "../../node_modules/";
var restify     = require("restify");
var pgRestify   = require("pg-restify");
var port        = 11001;

// create a simple restify server
var server = restify.createServer();

// add any additional custom server configuration

// add the pgRestify functionality
// by providing the restify instance
// and a server connection string
pgRestify.initialize({
  server: server,
  pgConfig: 'pg://localhost/gtel'
}, function(err, pgRestifyInstance) {

  // now that the query to get table metadata is done,
  // start the server
  server.listen(port, function(){
      console.log("Rest API Server started on port " + port );
  });

});