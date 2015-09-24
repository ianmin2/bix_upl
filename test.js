var pth         = "../../node_modules/";
var restify     = require(pth + "restify");
var pgRestify   = require("pg-restify");


// create a simple restify server
var server = restify.createServer();

// add any additional custom server configuration

// add the pgRestify functionality
// by providing the restify instance
// and a server connection string
pgRestify.initialize({
  server: server,
  pgConfig: 'pg://localhost/pg_restify'
}, function(err, pgRestifyInstance) {

  // now that the query to get table metadata is done,
  // start the server
  server.listen(1100);

});