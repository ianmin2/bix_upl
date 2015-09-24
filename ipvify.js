var os = require('os');
var server_addr = [];
var interfaces = os.networkInterfaces();
for ( var k in interfaces ){
    for( var k2 in interfaces[k]){
        var address = interfaces[k][k2];
        if(address.family === 'IPv4' && !address.internal){
           server_addr.push(address.address);
        }
    }  
};

server_addr = (server_addr[0] === undefined )? "localhost" : server_addr[0];

var Ipvify = function ( ip ){
    this.ip = ip.replace("::ffff:", "");
};

function SocketIP( handshake ){
    this.ip =  handshake.headers['x-forwarded-for'] || handshake.address;
};

//RETURN THE CURRENT MACHINE'S IP ADDRESS
exports.myAddr = server_addr;

//PROPERLY FORMAT AN IP ADDRESS
exports.ipvify = function(ip){
    return new Ipvify(ip).ip;
}; 

//PICK THE IP ADDRESS OFF A SOCKET HANDSHAKE
exports.socket = function( handshake ){
  return new Ipvify( new SocketIP( handshake ).ip ).ip;   
};