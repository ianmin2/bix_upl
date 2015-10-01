//!BASIC IMPORTS BEFORE APP INITIALIZATION
var os      = require("os");
var fs      = require("fs");
var zip     = require("adm-zip");
var http    = require("http");
var targz   = require("tar.gz");
var mandrill = require("mandrill-api/mandrill");
var c       = require("colors");

//!INITIALIZE THE COLORS MODULE ( for custom logging )
c.setTheme({
    success: 'green',
    err: 'red',
    info: 'blue'
});

//!LOAD THE CUSTOM MODULES
var ipvify  = require("./ipvify.js");
var app     = require("./bixbyte/server");
var main    = require("./bixbyte/main");
var log     = require("./logger.js")("./bixbyte/logs/app.log", true);

//!INITIALIZE THE EMAIL SENDER WITH THE API KEY
var mandrill_client = new mandrill.Mandrill("bTzP6ZlUlI55jRcyXAolzw");
log("Initialized mail sender client".success);

//!DEFINE THE APPLICATION PORT
var port = 1357;

//!CAPTURE THE SERVER IP
var server_addr = ipvify.myAddr;
log("Server startup configuration variable setup complete".success);

//!NOTIFY ASSISTANCE OF A SERVER RESTART ( WHERE NECESSARY )
if (main.mode != "development") {

    errMail("The Gtel photo upload server experienced an error and had to be restarted.\nSome transactions may have been lost in the process.\nPlease go through the application logs to ensure that all went well.\n\nTIMESTAMP:\n" + Date() + "\n\nMODE:" + main.mode, "THE GTEL PHOTO UPLOAD SERVER RESTARTED");

} else {

    log("Running procedural server reload".info);

    //!EO - Notify admin of server restart
}

//!REMOVE A DIRECTORY RECCURSIVELY
var rmdir = function(path) {

    log("Initializing the removal of the directory ".info + path);

    return new Promise(function() {


        if (fs.existsSync(path)) {

            fs.readdirSync(path).forEach(function(file, index) {

                var curPath = path + "/" + file;

                if (fs.lstatSync(curPath).isDirectory()) { // recurse

                    deleteFolderRecursive(curPath);
                    resolve({
                        status: 200,
                        message: "Successfully emptied the directory at ".success + path
                    });

                } else { // delete file

                    fs.unlinkSync(curPath);
                    resolve({
                        status: 200,
                        message: "Successfully removed the file at ".success + path
                    });

                }

            });

            fs.rmdirSync(path);
            resolve({
                status: 200,
                message: "Successfully removed the file at ".success + path
            });

        } else {
            resolve({
                status: 500,
                message: "No such file exists.\n".err + path
            });
        }
        /* log( "Failed to remove the directory".err + path );
      errMail("Failed to remove the directory " + path );*/

    });



    //!EO - Remove directory reccursively
};

//!FILESTREAM TO LOG VISITORS TO FILE
var visits = fs.createWriteStream("visitors.byt", {
    'flags': 'a',
    'encoding': null,
    'mode': 0666
});
log("Visitor logger established".success);

//!PACKAGE A USER'S ALBUM
var packageAlbum = function(g_user, g_album) {

    log("Initializing the packaging of ".info + g_album + " for ".info + g_user);

    return new Promise(function(resolve, reject) {

        var album_path = './uploads/' + g_user + "/" + g_album;
        var target_path = './albums/' + g_user + "_" + g_album;

        fs.exists(album_path, function(exists) {

            //!Album path exists
            if (exists) {

                //!Read album contents
                fs.readdir(album_path, function(err, files) {

                    //!Setup the basic album info 
                    var user_info = {
                        username: g_user,
                        album_name: g_album,
                        files: files,
                        created_at: new Date()
                    };

                    //!create an 'info.txt' file with the album details
                    fs.writeFileSync(album_path + "/info.txt", JSON.stringify(user_info));


                    //!Compress the folder 
                    var compress = new targz().compress(album_path, target_path + '.tar.gz', function(err) {

                        //!Handle a successful compression
                        if (!err) {

                            //!Delete the album folder
                            rmdir(album_path)
                                .catch(function(err) {
                                log(err.message);
                            })
                                .then(function(resp) {

                                log(resp.message);
                                sendMail(g_user, g_album);

                            })
                                .catch(function(err) {
                                log(err.message);
                            })
                                .then(function() {
                                resolve({
                                    status: 200,
                                    message: "Successfully packaged the album ".success + g_album
                                });
                            });


                        } else {

                            //!Failed to package the specified album                
                            resolve({
                                status: 500,
                                message: "Failed to package the album ".err + g_album + " for ".err + ipvify.ipvify(req.ip) + " : ".err + g_user + "\nReason: \n" + err
                            });

                        }


                    });

                    //!EO - Album read
                });

                //!Album path is non existent
            } else {

                resolve({
                    status: 500,
                    message: "A request for the album { ".err + g_album + " } belonging to { ".err + g_user + " } could not be fulfilled by the requesting client.\nReason: The path ".err + album_path + " is non existent.".err
                });


            }

            //!EO - File Exists   
        });

        //!EO - Promise    
    });

    //!EO - Package Album    
};


//!CREATE A DIRECTORY
var mkDir = function(dirName) {

    //!Use a promise to handle the process
    return new Promise(function(resolve, reject) {

        //!Check if the directory exists
        fs.stat(dirName, function(err, stats) {

            //!If directory does not exist
            if (err) {

                //!Make the directory
                fs.mkdir(dirName, function(err) {

                    //!Handle a successful directory creation
                    if (!err) {

                        resolve({
                            status: 200,
                            message: "Created the Directory ".success + dirName
                        });

                        //!handle unsuccessfull directory creation
                    } else {

                        resolve({
                            status: 500,
                            message: "Failed to create the Directory ".err + dirName
                        });

                    }

                    //!EO - file creation    
                });

                //!The directory exists
            } else {

                resolve({
                    status: 500,
                    message: "The Directory ".info + dirName + " already exists.".info
                });

            }

            //!EO - Directory status checker    
        });


        //!EO - Promise
    });

    /*!SAMPLE USAGE

        var dirs = ["albums","uploads"];

        dirs.reduce(function(sequence, dir ){
            return sequence.then(function(){
                return mkDir(dir);
            }).then(function( resp ){
                console.log( resp.message + "\n" );
            })
        }, Promise.resolve());

    !*/

};

//!HANDLE THE ACTUAL FILE UPLOAD
var imgUpload = function(tmp_path, target_path, filename, res) {

    log("attempting to move \nFrom:\t".info + tmp_path + "\nTo:\t".info + target_path);

    //!The promise 
    return new Promise(function(resolve, reject) {

        //Create streams to move the file
        var from = fs.createReadStream(tmp_path);
        var to = fs.createWriteStream(target_path);

        //!Stream the File from the temporary location
        from.pipe(to);

        //!Handle 'end of streaming' events
        from.on("end", function() {

            to.close();

            //!Remove the temporary file 
            fs.unlink(tmp_path, function(err) {

                //!Handle an unsuccessful file deletion
                if (err) {

                    //!Inform admin of file unlink error
                    errMail("Failed to remove the temporary file { " + tmp_path + " }.\nDetails:\n" + err);

                    //!Continue with the processing
                    resolve({
                        status: 500,
                        message: "Failed to remove the temporary file { ".err + tmp_path + " }.\nDetails:\n".err + err
                    });
                    //!Handle a successful file deletion
                } else {

                    //!Continue with processing
                    resolve({
                        status: 200,
                        message: "Removed the temporary file { ".success + tmp_path + " } ".success
                    });

                }

                //!EO - Remove temporary file
            });

            //!EO - File stream on end handler  
        });


        //!Handle 'error in stream' events
        from.on("error", function(err) {

            //!Continue with processing            
            resolve({
                status: 500,
                message: "The file { ".err + target_path + " } got an error.\nDetails:\n".err + err
            });
            //!Inform admin of file rename/move error 
            errMail("The file { ".err + target_path + " } got an error.\nDetails:\n".err + err);

            //!EO - File Upload Failed Error Handler 
        });

        //!EO - Promise    
    });

    //!EO - File Upload    
};

//!HANDLE THE UPLOAD PROCESS
var procIt = function(req, res) {

    log("Initializing the 'procIt' file upload module".success);

    //!Ensure that there is a file upload request
    if (typeof(req.files.userPhoto) != "undefined") {

        //!Check whether multiple images have been uploaded
        var isMultiple = (typeof(req.files.userPhoto[0]) === "undefined") ? false : true;

        //!capture the photo[s]
        var gtel_upload = req.files.userPhoto;

        //!capture the album name/title
        var g_album = main.sanitize(req.body.g_album);

        //!capture the username
        var g_user = req.body.g_user;

        //!Ensure that the album title is defined
        if (typeof(req.files.userPhoto) != "undefined") {

            //!Check the album title for a min length
            if (g_album.length < 3) {

                //!Ask the client to provide an album title
                res.send(main.makeResponse("ERROR", "Please Specify an Album title", "albumTitle"));

                //!Handle an acceptable album name
            } else {

                //!Handle multiple image upload
                if (isMultiple) {

                    var image_counter = 0;

                    //!Keep a log of the ongoing procedure
                    log("Upload of album started. ".success + "\nObjects present:\t".info + gtel_upload.length);

                    //!Handle file upload 
                    gtel_upload.reduce(function(sequence, imageFile) {

                        //!Chain an asynchronous file upload
                        return sequence.then(function() {

                            //!Validate the image before initiating an upload
                            if (isValidType(imageFile.mimetype, imageFile.path)) {

                                //!Setup the needed variables
                                var tmp_path = imageFile.path;
                                var target_path = "./uploads/" + g_user + "/" + g_album + "/" + imageFile.originalname;

                                return imgUpload(tmp_path, target_path, "", "");

                                //!Handle invalid mimetype requests
                            } else {

                                log({
                                    status: 200,
                                    message: "An unsopported file type from ".err + ipvify.ipvify(req.ip) + " was encountered.\nFile type:\t".err + gtel_upload.mimetype + "\nFile name:\t".err + gtel_upload.originalname
                                });

                                //!EO - Mimetype validation
                            }

                            //!Log the upload response after file upload attempt  
                        }).then(function(resp) {

                            //Log What happened 
                            log(resp.message);

                            //!Handle all overlooked errors that might have occured in the upload process 
                        }).catch(function(err) {

                            log("CRITICAL OVERLOOKED ERROR: \n".err + err.message);

                            //!Add the "images_uploaded" counter and take the appropriate function
                        }).then(function() {

                            //!Increment the counter object 
                            image_counter++;

                            //!Check if this is the final image to be uploaded
                            if (image_counter == gtel_upload.length) {

                                //!Inform the client of a successfull upload of files
                                res.send(main.makeResponse("SUCCESS", "Your Files Have been Uploaded!", "complete"));
                                log("Upload of album complete. ".success + "\nObjects present:\t".info + gtel_upload.length);

                            } else {

                                log("Uploaded ".info + image_counter + " of ".info + gtel_upload.length);

                                //!EO - Check if is last image file    
                            }

                        });

                    }, Promise.resolve());

                    //!EO - Multiple requests 
                    //!Handle single image uploads
                } else {

                    //!Validate the submitted file
                    if (isValidType(gtel_upload.mimetype, gtel_upload.path)) {

                        log("Upload of single image file started".success);

                        var tmp_path = gtel_upload.path;
                        var target_path = "./uploads/" + g_user + "/" + g_album + "/" + gtel_upload.originalname;

                        //!Upload the image
                        imgUpload(tmp_path, target_path, gtel_upload.originalname, "")
                        //!Log the result of the upload
                            .then(function(resp) {
                            log(resp.message);
                        })
                        //!Catch any overlooked errors
                            .catch(function(err) {
                            log("CRITICAL OVERLOOKED ERROR: \n".err + err.message);
                        })
                        //!Return the response to the client
                            .then(function() {

                            //!Inform the client of a successfull upload of the file
                            res.send(main.makeResponse("SUCCESS", "Your File Has been Uploaded!", "complete"));
                            log("Upload of single image file complete".success);

                        });

                    } else {

                        //!Log that the filetype was unsupported
                        log("An unsopported file type from ".err + ipvify.ipvify(req.ip) + " was encountered.\nFile type:\t".err + gtel_upload.mimetype + "\nFile name:\t".err + gtel_upload.originalname);

                        //!EO - MIMETYPE validation
                    }

                    //!EO - single file upoad
                }

                //!EO -  Check for Album name    
            }

            //!Handle an undefined album title 
        } else {

            //!Ask the client to provide an album title
            res.send(main.makeResponse("ERROR", "Please Specify an Album title", "albumTitle"));

            //!EO - Album title is defined    
        }


        //!Handle No File(s) was/were provided for upload  
    } else {

        //!No files are provided for upload
        log("No Files were provided by ".err + ipvify.ipvify(req.ip) + " for upload.".err);

        //!Let the user no that no file was provided for upload
        res.send(main.makeResponse("ERROR", "No file was provided for upload", ""));

        //!EO - Photo Exists    
    }

    //!EO - Handle file upload process    
};

//!CAPTURE THE COMPLETION OF AN ALBUM UPLOAD
app.route("/gtel/api/done/:user/:album").all(function(req, res) {

    var g_user = req.params.user;
    var g_album = main.sanitize(req.params.album);

    log("Processing packaging request.\nUser:\t".info + g_user + "\nAlbum:\t".info + g_album);

    res.setHeader("content-type", "application/json");

    //!Ensure that both the user and album are clearly defined
    if (typeof(g_user) === "undefined" || typeof(g_album) === "undefined") {

        //Appropriately handle an invalid request
        log("Failed to get the user and/or album name from the user at ".err + ipvify.ipvify(req.ip));

        res.send(main.makeResponse("ERROR", "Failed to capture the required user details to compllete upload request", ""));

    } else {

        //!Zip and mail the file to the relevant parties
        packageAlbum(g_user, g_album)
        //!Display the result of the packaging
            .then(function(resp) {
            log(resp.message);
        })
        //!Return a "SUccess" response to the client
            .then(function() {
            res.send(main.makeResponse("SUCCESS", "Album successfully submitted for  printing", ""));
        })
        //!Capture any errors
            .catch(function(err) {
            res.send(main.makeResponse("ERROR", err.message, ""));
        });


    }
    //!EO - Album Package request    
});

//!CAPTURE ALBUM CONTENT DOWNLOAD REQUESTS
app.route("/gtel/api/admin/:path").all(function(req, res) {

    //!Capture the file path
    var $path = decodeURI(req.params.path);

    log(ipvify.ipvify(req.ip) + " requested the album archive at ".info + $path);

    //!Prepare the server to stream the file to the client
    var myFile = fs.createReadStream("./albums/" + $path);
    $path = $path.replace(/ /g, "_");

    //!Stream the requested file to the client
    try {

        //!Set the relevant application headers
        res.setHeader('content-disposition', 'attachment; filename=' + $path);

        res.setHeader('content-type', 'application/x-gzip');

        myFile.pipe(res);

        log("Streaming the archive ".success + $path + " to ".success + ipvify.ipvify(req.ip));

    } catch (e) {

        //!Handle a failed attempt
        log("Failed to stream the archive ".err + req.params.path + " to ".err + ipvify.ipvify(req.ip) + "\nError: ".info + e);

    }

    //!Handle file streaming errors
    myFile.on("error", function(err) {

        //!Inform the user of the catastrophic error
        res.setHeader('content-disposition', 'inline; filename=' + $path);
        res.setHeader('content-type', 'text/html');
        res.sendFile(__dirname + "/bixbyte/server/views/nsfe.html");
        log("Failed to stream the album ".err + $path + " to ".err + ipvify.ipvify(req.ip));

    });

    myFile.on("end", function(err) {

        log("Album successfully downloaded.\nDETAILS:\t".success + $path + " by ".success + ipvify.ipvify(req.ip));

    });

    //!EO - Album downloader    
});

//!CAPTURE FILE UPLOAD REQUESTS
app.route("/gtel/api/photo").all(function(req, res) {

    //!Get the client's ip address
    var ip = ipvify.ipvify(req.ip);

    //!Log the request
    log("New photo upload request from ".info + ip);

    //!Add to the list of visitors
    visits.write("," + ip);

    //!Fetch the user's username
    var g_user = req.body.g_user;

    //!Authenticate the user 
    if (typeof(g_user) === "undefined") {

        //!Inform the administrators of the security threat
        errMail(ip + " tried to hack you @ the gtel photo app!\n\n TIMESTAMP: " + Date());

        //!Log the attempted hack incidence
        log(ip + " tried to hack you @ the gtel photo app!\n\n TIMESTAMP: ".err + Date());

        //!Redirect the potential hacker
        res.redirect("/");

    } else {

        log("User authenticated.. proceeding to file upload".info);

        // TO DO : Authenticate the user //

        //!capture the album name
        var g_album = main.sanitize(req.body.g_album);


        //!Define the response type
        res.setHeader("content-type", "application/json");

        //!Ensure that the requesting user has a directory assigned to them
        if (!fs.existsSync("uploads/" + g_user)) {

            //!Create user directory
            fs.mkdirSync("uploads/" + g_user, function(err) {
                if (err) {
                    //Warn maintenance of the ground breaking error
                    errMail("The photo album application failed to create a directory for the user {" + g_user + "} \n\n Reason: \n" + err);
                    log("ERR: COULD NOT CREATE THE 'user' DIRECTORY FOR USER '".err + g_user + "'\nREASON:\n".err + err);
                }
            });

        }

        //!Create the upload album directory in their relevant assigned folders
        if (!fs.existsSync("uploads/" + g_user + "/" + g_album)) {

            fs.mkdirSync("uploads/" + g_user + "/" + g_album, function(err) {
                if (err) {

                    //Warn maintenance of the ground breaking error
                    errMail("The photo album application failed to create an album directory ( " + g_album + " ) for the user {" + g_user + "} \n\n Reason: \n" + err);

                    log("ERR: COULD NOT CREATE THE 'album' { ".err + g_album + " } DIRECTORY FOR USER '".err + g_user + "'\nREASON: ".err + err);
                }

            });

        }

        //!Handle the actual file upload        
        procIt(req, res);

    }

    //!EO - Capture File Upload Requests   
});

//!IMAGE UPLOAD CONSTRAINTS VALIDATOR
var isValidType = function(mimeType, path) {

    log("Checking the validity of".info + path);

    //!Check for the validity / acceptability of the uploaded image
    if (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/gif" || mimeType === "image/x-ms-bmp") {
        return true;

    } else {
        //!unlink the temporary wanted file
        fs.unlink(path);
        return false;
    }
    //!EO - Image validator  
};

//!DEFAULT EMAIL SENDER CONFIGURATION
var mail = function(g_user, g_album) {

    //!Uri encode the path of the album
    var myPath = encodeURI("http://" + server_addr + ":" + port + "/gtel/api/admin/" + g_user + "_" + g_album + ".tar.gz");

    //!Define the primitive email template
    var message = {
        "html": '<table style="background:white; color:white; margin: 0 auto; height:400px;" width="70%" ><tr style="background:black; color: white; max-height:100px !important;"><td align="center"><img src="http://' + server_addr + ':' + port + '/logo.png" style="left:0px;  "><h1 style="color:white;"> Bixbyte </h1> </td></tr><tr style="background:black; min-height: 300px; color: white; text-align: justified;"><td style=" padding: 10px;"><p>The User <b>' + g_user + '</b> requested the printing of the album <b>' + g_album + '</b>. </p > <br><br> <div style="padding:3px; border-radius:4px; background: teal; text-align: center;">  <a style=" color:#2135ed; text-decoration:none;" href="' + myPath + '">Download ' + g_user + '_' + g_album + '.tar.gz </a> </div> </td></tr><tr style="background:black; text: white; max-height:100px;"><td align="center">P.O BOX 49599 - 00100, Nairobi Kenya</td></tr></table>',
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
    var async = true;
    var ip_pool = "Main Pool";
    var send_at = "example send_at";

    //!The actual email conveyor
    mandrill_client.messages.send({
        "message": message,
        "async": async
    }, function(result) {
        log("Email sending result:\n".info + JSON.stringify(result));
    }, function(e) {
        log("Failed to send an email. \n\nDetails:\nName:".err + e.name + "\nDescription:\n".err + e.message);
    });

    //!EO - Email sender configuration
};

//!EMAIL SENDING HANDLER
var sendMail = function(g_user, g_album) {

    log("Initializing the email sender".info);

    //!Send the email
    mail(g_user, g_album);

    //!EO - Email sending handler
};

//!THE ASYNCRONOUS EMAIL SENDER METHOD
var isendMail = function(g_user, g_album) {

    //!Check if the compressed album exists
    fs.exists("./albums/" + g_user + "/" + g_album + ".tar.gz", function(exists) {

        log("Initializng an asynchronous email request");

        //!Handle an existing album
        if (exists) {

            //!Mail the required parties
            mail(g_user, g_album);

        } else {

            //!Notify relevant parties of inaccessible zipped album
            errMail("Failed to locate tthe package ".err + g_album + ".tar.gz/n/nDetails:\nUser: \t" + g_user + "\nDetails:\t" + err);

            //!EO - Handle existing albums
        }

        //!EO - Check if File exists    
    });

    //EO - Asyncronous email sender   
};

//!ENSURE THAT THE MAIN DIRECTORIES ARE DONE
var dirs = ["albums", "uploads"];

dirs.reduce(function(sequence, dir) {
    return sequence.then(function() {
        return mkDir(dir);
    }).then(function(resp) {
        log(resp.message + "\n");
    })
}, Promise.resolve());


//!HOOK THE SERVICE TO A PORT
app.listen(port, function() {
    log("Application running on ".success + "http://" + server_addr + ":" + port);
});