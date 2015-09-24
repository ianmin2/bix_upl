//!Perform the basic imports before application initialization
var os          = require("os");
var fs          = require("fs");
var zip         = require("adm-zip");
var http        = require("http");
var targz       = require("tar.gz");
var mandrill    = require("mandrill-api/mandrill");

//!The colors module
var c   	    = require("colors");

c.setTheme({  
      success:  'green',
      err:      'red',
      info:     'blue'
});

//!Custom made modules
var ipvify          = require("./ipvify.js");
var app             = require("./bixbyte/server");
var main            = require("./bixbyte/main");
var log 	    = require("./logger.js")("./bixbyte/logs/app.log", true );

//!Initialize the mandrill api with
var mandrill_client     = new mandrill.Mandrill("bTzP6ZlUlI55jRcyXAolzw");
log("Initialized mail sender client".success);
//!Set the application port
var port        = 1357;

//!Capture the server address
var server_addr = ipvify.myAddr;
log("Server startup configuration variable setup complete".success);

/*!
    CUSTOM FUNCTIONS
*/

//!Remove a directory recurrsively
var rmdir = function(path) {
    
    log("Initializing the removal of the directory ".info + path );
    
  try{  
      
      if( fs.existsSync(path) ) {

        fs.readdirSync(path).forEach(function(file,index){

          var curPath = path + "/" + file;

          if(fs.lstatSync(curPath).isDirectory()) { // recurse

            deleteFolderRecursive(curPath);

          } else { // delete file

            fs.unlinkSync(curPath);

          }

        });

        fs.rmdirSync(path);

      }
      
  }catch(e){
      
      log( "Failed to remove the directory".err + path );
      errMail("Failed to remove the directory " + path );
      
  }
    
};

//!Handle error email sending
var errMail = function($message, $subject) {

    var subject = ( $subject === "" )? "Critical Error encountered by the GTel Photo Album" : $subject;      
    
    var message = {
        "html": "",
        "text": $message.toString(),
        "subject": subject ,
        "from_email": "errors@bixbyte.cf",
        "from_name": "Bixbyte Apps Error Reporter",
        "to": main.adminmail,
        "headers": {
            "Reply-To": "noreply@bixbyte.cf"
        },
        "important": true,
        "track_opens": true
    };

    mandrill_client.messages.send({
        "message": message,
        "async": false
    }, function (result) {
        log("Email sending result:\n".success + JSON.stringify(result));
    }, function (e) {
        log('Error while trying to send email:\n'.err + e.name + ' - '.err + e.message);        
    });

}

//!Send a notification to the administrator of  a server startup incident
if( main.mode != "development" ){

errMail( "The Gtel photo upload server experienced an error and had to be restarted.\nSome transactions may have been lost in the process.\nPlease go through the application logs to ensure that all went well.\n\nTIMESTAMP:\n"+ Date() + "\n\nMODE:"+ main.mode , "THE GTEL PHOTO UPLOAD SERVER RESTARTED" );

}else{
 
    log("Running procedural server reload".info);
    
}


//!Create a data stream to write to file
var visits = fs.createWriteStream("visitors.byt",{ 'flags':'a', 'encoding':null, 'mode': 0666});
log("Visitor logger established".success);


//!Handle file upload requests
app.route("/gtel/api/photo").all(function(req,res){
    
    //!Get the client's ip address
    var ip = ipvify.ipvify(req.ip);
    
    //!Log the request
    log( "New photo upload request from ".info + ip );
    
    //!Add to the list of visitors
    visits.write( "," + ip );
    
    //!Fetch the user's username
    var g_user = req.body.g_user;
    
    //!Authenticate the user 
    if( typeof(g_user) === "undefined" ){
        
        //!Inform the administrators of the security threat
        errMail(ip + " tried to hack you @ the gtel photo app!\n\n TIMESTAMP: " + Date());
        
        //!Log the attempted hack incidence
        log(ip + " tried to hack you @ the gtel photo app!\n\n TIMESTAMP: ".err + Date());
        
        //!Redirect the potential hacker
        res.redirect("/");
        
    }else{
        
        log("User authenticated.. proceeding to file upload".info);
        
        // TO DO : Authenticate the user //
        
        //!capture the album name
         var g_album = main.sanitize(req.body.g_album);
        
        //!Define the response type
        res.setHeader("content-type","application/json");
        
        //!Ensure that the requesting user has a directory assigned to them
        if (!fs.existsSync("uploads/" + g_user)) {
            
            //!Create user directory
            fs.mkdirSync("uploads/" + g_user, function (err) {
                if (err) {
                    //Warn maintenance of the ground breaking error
                    errMail("The photo album application failed to create a directory for the user {" + g_user + "} \n\n Reason: \n" + err );
                    log("ERR: COULD NOT CREATE THE 'user' DIRECTORY FOR USER '".err + g_user + "'\nREASON:\n".err + err);
                }
            });
            
        }
        
        //!Create the upload album directory in their relevant assigned folders
        if (!fs.existsSync("uploads/" + g_user + "/" + g_album)) {
            
            fs.mkdirSync("uploads/" + g_user + "/" + g_album, function (err) {
                if (err) {
                    
                    //Warn maintenance of the ground breaking error
                    errMail("The photo album application failed to create an album directory ( " + g_album + " ) for the user {" + g_user + "} \n\n Reason: \n" + err);
                    
                    log("ERR: COULD NOT CREATE THE 'album' { ".err + g_album + " } DIRECTORY FOR USER '".err + g_user + "'\nREASON: ".err + err);
                }
                
            });
            
        }
        
        
        //!Handle the actual file upload        
        procIt(req,res)  ;    
    }
    
});
    
    
//!Handle the completion of an album upload.
app.route("/gtel/api/done/:user/:album").all(function(req,res){
    
    var g_user = req.params.user;
    var g_album = main.sanitize(req.params.album);
    
    log("Processing packaging request.\nUser:\t".info + g_user + "\nAlbum:\t".info + g_album );
    
    res.setHeader("content-type","application/json");
    
    //!Ensure that both the user and album are clearly defined
    if( typeof(g_user) === "undefined" || typeof(g_album) === "undefined" ){
        
        //Appropriately handle an invalid request
        log( "Failed to get the user and/or album name from the user at ".err + ipvify.ipvify(req.ip) );
        
        res.send( main.makeResponse("ERROR","Failed to capture the required user details to compllete upload request","") );
            
    }else{
        
        //!Zip and mail the file to the relevant parties
        packageAlbum( g_user, g_album );
        res.send( main.makeResponse("SUCCESS","Album successfully submitted for  printing","") );
        
    }    
    
});
    
//!The album content downloader
app.route("/gtel/api/admin/:path").all( function(req,res){
  
      //!Capture the file path
    var $path = decodeURI( req.params.path );
    
    log( ipvify.ipvify(req.ip) + " requested the album archive at ".info + $path );
    
    //!Prepare the server to stream the file to the client
    var myFile = fs.createReadStream("./albums/"+$path);
    $path = $path.replace(/ /g, "_");

     //!Stream the requested file to the client
    try{

        //!Set the relevant application headers
        res.setHeader('content-disposition','attachment; filename='+$path);

        res.setHeader('content-type','application/x-gzip');

        myFile.pipe(res);

        log("Streamed the archive ".success + $path + " to ".success + ipvify.ipvify(req.ip) );

    }catch(e){

        //!Handle a failed attempt
        log("Failed to stream the archive ".err + req.params.path + " to ".err + ipvify.ipvify(req.ip) + "\nError: ".info + e); 

    }
   
    //!Handle file streaming errors
    myFile.on("error", function(err){
        
        //!Inform the user of the catastrophic error
        res.setHeader('content-type', 'text/html');
        res.sendFile( __dirname + "/bixbyte/server/views/nsfe.html");
        log("Failed to stream the album ".err + $path + " to ".err + ipvify.ipvify(req.ip) );
        
    });  
    
});
    
    
    




//!The Upload process handler
var procIt = function( req, res ){
    
    log("Initializing the 'procIt' file upload module".success);
    
    //!Ensure that there is a file upload request
    if( typeof(req.files.userPhoto) != "undefined" ){
        
        //!Check whether multiple images have been uploaded
        var isMultiple = ( typeof(req.files.userPhoto[0]) === "undefined" )? false : true ;
        
        //!capture the photo[s]
        var gtel_upload =  req.files.userPhoto;
        
        //!capture the album name/title
         var g_album = main.sanitize(req.body.g_album);
        
        //!capture the username
        var g_user = req.body.g_user;
        
        //!ensure that a valid album title is defined
        if( typeof(g_album) != "undefined" ){
            
            //!Check the album title for a min length
            if( g_album.length < 3 ){
                
                //!Ask the client to provide an album title
                res.send(main.makeResponse("ERROR", "Please Specify an Album title", "albumTitle"));
             
            //!Acceptable album name
            }else{
                
                //!Handle multiple image upload
                if( isMultiple ){
                                       
                    //!Check the file types for compliance
                    log( "Upload of album started. ".success + "\nObjects present:\t".info + gtel_upload.length );
                    
                    //!Iteratively upload the files
                    for( ith in gtel_upload ){
                        
                        //!Validate the image before initiating an upload
                        if( isValidType( gtel_upload[ith].mimetype, gtel_upload[ith].path ) ){
                            
                            var tmp_path = gtel_upload[ith].path;
                            var target_path = "./uploads/" + g_user + "/" + g_album + "/" + gtel_upload[ith].originalname ;
                            
                            //!Upload the image
                            imgUpload( tmp_path, target_path, "", res );
                            
                        }else{
                            
                            //!Keep a record that the file provided is unsupported
                            log("An unsopported file type from ".err + ipvify.ipvify(req.ip) + " was encountered.\nFile type:\t".err + gtel_upload[ith].mimetype + "\nFile name:\t".err + gtel_upload[ith].originalname );
                            
                        }
                        
                    }
                    
                    //!Inform the client of a successfull upload of files
                    res.send( main.makeResponse("SUCCESS","Your Files Have been Uploaded!","complete") );
                    log( "Upload of album complete. ".success + "\nObjects present:\t".info + gtel_upload.length );
                    
                //!EO - Multiple requests     
                }else{
                    
                    //!Handle single image uploads
                    
                    //!Validate the submitted file
                    if( isValidType(gtel_upload.mimetype, gtel_upload.path) ){
                        
                        log( "Upload of single image file started".success );
                        
                        var tmp_path = gtel_upload.path;
                        var target_path = "./uploads/" + g_user + "/" + g_album + "/" + gtel_upload.originalname;
                        
                        //!Upload the image
                        imgUpload( tmp_path, target_path, gtel_upload.originalname, res );
                         
                    }else{
                        
                        //!Log that the filetype was unsupported
                        log("An unsopported file type from ".err + ipvify.ipvify(req.ip) + " was encountered.\nFile type:\t".err + gtel_upload.mimetype + "\nFile name:\t".err + gtel_upload.originalname );
                        
                    }
                    
                    //!Inform the client of a successfull upload of the file
                    res.send( main.makeResponse("SUCCESS","Your File Has been Uploaded!","complete") ); 
                    log( "Upload of single image file complete".success );
                //!EO - single file upoad
                }              
                
                
            //!EO - Acceptable Album name   
            }
        
        //!EO - defined album name
        }else{
            
            //!Ask the client to provide an album title
            res.send(main.makeResponse("ERROR", "Please Specify an Album title", "albumTitle"));
         
        //!EO - undefined album name
        }
        
    //!EO - User photo is defined    
    }else{
        
        //!No files are provided for upload
        log( "No Files were provided by ".err + ipvify.ipvify(req.ip) + " for upload.".err );
        
        //!Let the user no that no file was provided for upload
        res.send( main.makeResponse("ERROR","No file was provided for upload", "") );
        
    }
    
};


//!Handle the actual image upload
var imgUpload = function( tmp_path, target_path, filename, res ){
  
    log( "attempting to move \nFrom:\t".info +tmp_path + "\nTo:\t".info + target_path );
    
    //Create streams to move the file
    var from = fs.createReadStream(tmp_path);
    var to   = fs.createWriteStream(target_path);
    
    from.pipe(to);
    
    //!Handle 'end of streaming' events
    from.on("end",function(){
        
       to.close();
        
       fs.unlink( tmp_path ,function(err){
        if (err) {
                    //!Inform admin of file unlink error
                    errMail("Failed to remove the temporary file { " + tmp_path + " }.\nDetails:\n" + err);
                    //!Log the error
                    log("Failed to remove the temporary file { ".err + tmp_path + " }.\nDetails:\n".err + err);
                } else{
                    
                    //!Keep a record of the successfull unlinking
                    log("Removed the temporary file { ".success + tmp_path + " } ".success);
                    
                }

        });
        
    });
    
    //!Handle 'error in stream' events
    from.on("error", function(err){
        
        //!Log the error
        log("The file { ".err + target_path + " } got an error.\nDetails:\n".err + err);
        //!Inform admin of file rename/move error 
        errMail("The file { ".err + target_path + " } got an error.\nDetails:\n".err + err);
        
    });
    
};


//!Package the album and send a notification to the relevant parties informing them of the addition
var packageAlbum = function( g_user, g_album ){
    
    log( "Initializing the packaging of ".info + g_album + " for ".info + g_user )
    
    var album_path = './uploads/' + g_user + "/" + g_album;
    var target_path = './albums/' + g_user + "/" + g_album;
    
    //!Check that the requested album exists
    fs.exists( album_path , function(exists){
        
        if( exists ){
            
            fs.readdir( album_path , function(err,files){
                
                var user_info = {
                                    username    : g_user,
                                    album_name  : g_album,
                                    files       : files                  
                                };
                
                //!create an 'info.txt' file with the album details
                fs.writeFileSync( album_path + "/info.txt", JSON.stringify(user_info) );
                
                
                //!Compress the album
                /*    var src = targz().createReadStream( album_path + "/");
                var dest = fs.createWriteStream("./albums/"+ g_user + "_" + g_album + ".tar.gz" );
                
                src.pipe(dest);
                
                //!Handle a successful compression
                src.on("end", function(){
                    
                    //!Delete the album folder
                    rmdir( album_path );
                    sendMail( g_user, g_album );

                    //!Log the current process
                    log("Successfully packaged the album ".success + g_album  );

                });
                
                //!Handle a file compression error
                src.on("error", function(){
                    //!Failed to package the specified album
                    log("Failed to package the album ".err + g_album + " for ".err + ipvify.ipvify(req.ip) + " : ".err + g_user );
                });*/
                
                
                var compress = new targz().compress(  album_path , target_path + '.tar.gz', function(err){
                    
                    //!Handle a successful compression
                    if(!err){
                        
                        //!Log the current process
                        log("Successfully packaged the album ".success + g_album  );
                        
                        //!Delete the album folder
                        rmdir( album_path );
                        sendMail( g_user, g_album );
                        
                        
                        
                        
                    }else{
                        
                        //!Failed to package the specified album
                        log("Failed to package the album ".err + g_album + " for ".err + ipvify.ipvify(req.ip) + " : ".err + g_user + "\nReason: \n" + err);
                        
                    }
                    
                });
                
                
            });
            
        //!EO - User album exists    
        }else{
            
            //errMail( "A request for the album { " + g_album + " } belonging to { " + g_user + " } could not be fulfilled by the requesting client." ); 
log( "A request for the album { ".err + g_album + " } belonging to { ".err + g_user + " } could not be fulfilled by the requesting client.\nReason: The path ".err + album_path + " is none existent.".err );
            
        //!EO - User album does not exist    
        }
        
     //!EO - fs.exists  
    });
    
};
    
    
//!Image upload Constraints validator
var isValidType = function( mimeType, path ){
    
    log("Checking the validity of".info + path ); 
    
    //!Check for the validity / acceptability of the uploaded image
    if( mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/gif" || mimeType === "image/x-ms-bmp"){
        return true;
    }else{
        //!unlink the temporary wanted file
        fs.unlink(path);
        return false;
    }
    
};


//!The default email sender configuration
var mail = function( g_user, g_album ){
    
    //!Uri encode the path of the album
    var myPath = encodeURI( "http://" + server_addr + ":" + port + "/albums/" + g_user + "_" + g_album + ".tar.gz" );
    
    //!Define the primitive email template
    var message = {
        "html" :  '<table style="background:white; color:white; margin: 0 auto; height:400px;" width="70%" ><tr style="background:black; color: white; max-height:100px !important;"><td align="center"><img src="http://'+server_addr+':'+ port +'/logo.png" style="left:0px;  "><h1 style="color:white;"> Bixbyte </h1> </td></tr><tr style="background:black; min-height: 300px; color: white; text-align: justified;"><td style=" padding: 10px;"><p>The User <b>' + g_user + '</b> requested the printing of the album <b>' + g_album + '</b>. </p > <br><br> <div style="padding:3px; border-radius:4px; background: teal; text-align: center;">  <a style=" color:#2135ed; text-decoration:none;" href="'+ myPath + '">Download ' + g_user+'_'+g_album+'.tar.gz </a> </div> </td></tr><tr style="background:black; text: white; max-height:100px;"><td align="center">P.O BOX 49599 - 00100, Nairobi Kenya</td></tr></table>',
        "text": "The User " + g_user + " requested the printing of the album '" + g_album + "' \n\nYou can download it at " + myPath,
        "subject": g_user + "_" + g_album + " album print request",
        "from_email": "albums@bixbyte.cf",
        "from_name": "Bixbyte Photo Album Notifier",
        "to": main.usermail,
        "headers": {
            "Reply-To": "info@bixbyte.cf"
        },
        "important": true,
        "track_opens": true
        /*,
        "attachments": [{
        "type": "application/x-gzip",
        "name": g_user + "_" + g_album + ".tar.gz",
        "content": f
                                    }]
                                    */
    };
    
   //!optional parameter setup
    var async = false;
    var ip_pool = "Main Pool";
    var send_at = "example send_at";
    
    //!The actual email conveyor
    mandrill_client.messages.send({
        "message": message,
        "async": async
    },function(result){
        log("Email sending result:\n".info + JSON.stringify(result) );
    },function(e){
        log("Failed to send an email. \n\nDetails:\nName:".err + e.name + "\nDescription:\n".err + e.message );
    });
    
};

//!The actual email sender
var sendMail = function( g_user, g_album ){
    
    log("Initializing the email sender".info);
    
    //!Send the email
    mail( g_user, g_album );    
    
};
    
//!The asynchronous email sender method
var isendMail = function( g_user, g_album ){
    
    //!Check if the compressed album exists
    fs.exists( "./albums/" + g_user + "/" + g_album + ".tar.gz", function(exists){
        
        log("Initializng an asynchronous email request");
        
        //!Handle an existing album
        if( exists ){
            
            //!Mail the required parties
            mail( g_user, g_album );
            
        }else{
            
            //!Notify relevant parties of inaccessible zipped album
            errMail( "Failed to locate tthe package ".err + g_album + ".tar.gz/n/nDetails:\nUser: \t" + g_user + "\nDetails:\t" + err );
            
        }
        
        
    });
    
};
    
//!Ensure that the 'uploads' directoty exists
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads", function (err) {
        if (err) {
            
            //!Inform the administrator(s) of impending doom
            errMail("Gtel Photo upload server\nFailed to create the 'uploads' directory on startup.\nReason: \n" + err);
            
            log("Failed to create the directory ".err + " 'uploads'\n" + "REASON:\n".err + err);
        }else{
            log("Initialized the 'uploads' directory.".success);
        }
    });
};
    
//!Ensure that the 'albums' directory exists
if (!fs.existsSync("albums")) {
    fs.mkdirSync("albums", function (err) {
        if (err) {
            //Consider warning admin of catastrophic error
            errMail("Gtel Photo upload server\nFailed to create the 'albums' directory on startup.\n\n Reason: \n" + err);
           log("Failed to create the directory ".err + " 'albums'\n" + "REASON:\n".err + err);
         }else{
            log("Initialized the 'albums' directory.".success);
        }
    });
}
    
//!Hook the service to a port
app.listen(port, function(){
    log("Application running on ".success + "http://" + server_addr +":"+ port);
});
