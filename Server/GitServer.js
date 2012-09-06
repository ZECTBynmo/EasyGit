var port = typeof( process.env.PORT ) == "undefined" ? 5000 : process.env.PORT;

var fs = require("fs");
var exec = require('child_process').exec;
var wrench = require("./wrench-js/lib/wrench");
var git = require("./GitOperations.js");
var async = require("async");

var zipper = require("node-native-zip");
var folder = require( "./folder" );
var AdmZip = require('adm-zip');
var unzip; 

// To be determined later
var baseDir;
var fileName; 
var fileData;
var TagOrSHA;
var isUpdateOnly = false; // Set when we're just looking to update the server to the most recent state of the repo and zip the directory

var isLocked = false;
var currentUser = null;
var commitMessage = null;

// This will hold the function that we're going to call next. It
// makes our very asynchronous code cleaner.
var nextStep = function() {};

console.log( "Opening socket on port " + port );
var io  = require( 'socket.io' ).listen(port+1);
var dl = require("delivery");

io.sockets.on('connection', function(socket){
	var delivery = dl.listen(socket);
	
	delivery.on( 'send.error', function( error ) {
		console.log( error );
		console.log( "send error: " + error );
	});
	
	delivery.on( 'send.start', function( filePackage ) {
		console.log(filePackage.name + " is being sent to the client.");
	});

	delivery.on('send.success', function(file){ 
		console.log('File successfully sent to client!'); 
	});	

	console.log( "Socket connection" );
	
	socket.on( "requestTransfer", function( data ) {
		console.log( "transfer requested" );
		console.log( data );
		if( isLocked ) {
			emitError( "Transfer locked: server busy" );
			return;
		} else {
			currentUser = socket.id;
			baseDir = data.baseDir;
			commitMessage = data.commitMessage;
			
			io.sockets.socket( currentUser ).emit( "transferAccepted" );
			
			isLocked = true;			
		}
	});
	
	socket.on( "requestHEAD", function( data, SHACallback ) {
		console.log( "update to HEAD requested" );
		
		var deliveryObj= {
			name: data.fileName,
			path: getOneFolderUp(data.baseDir) + data.fileName
		};
		console.log( data );
		console.log( deliveryObj );
		
		if( isLocked ) {
			emitError( "Transfer locked: server busy" );
			return;
		} else {
			console.log( "Checking out" );
			
			// Run our git operations asynchronously
			async.series([
				function( callback ) { 
					git.getAsyncSHA( function( SHA ) {		
						// Update our global variable
						TagOrSHA = SHA;		
						
						// Update the client with the SHA
						socket.emit( "updateSHA", {TagOrSHA: SHA} );
						
						socket.on( "receivedSHA", function() {
							callback( null, "Sent SHA to client" );
						});				
					});
				},
				function( callback ) { 
					var undefinedVar;
					git.checkout( null, null, callback );
				},
				function( callback ) { 
					git.pull( true, callback );
				},
				function( callback ) {
					console.log( "Zipping" );
					zipDirectory( data.baseDir, function() {
						console.log( "Zipped directory" );
						console.log( deliveryObj );
						try { delivery.send( deliveryObj ); } 
						catch(err) { console.log( err ); callback(err); }
						
						callback( null, "Success" );
					}); // end zip dir
				},
			], function(err, results){
				console.log( err || results );
			});			
		} // end if not locked
	}); // end on request HEAD
  
	delivery.on('receive.success',function(file){
		var fileNameWithoutPath = getFileNameFromPath( file.name );
		
		fileName = fileNameWithoutPath;
		
		// Create our temp directory if it doesn't exist already
		if( !dirExistsSync( "temp" ) ) {
			fs.mkdir( "temp" );
		}
		
		fs.writeFile( "temp/" + fileNameWithoutPath, file.buffer, function( err ) {
			if( err ) {
				console.log( 'File could not be saved: ' + err );
			} else {
				console.log( 'File ' + file.name + " saved" );
				
				var currentSHA;
				
				// Run our git operations asynchronously
				async.series([
					function( callback ) { 
						socket.emit( "getSHA", {} );
						socket.on( "sendSHA", function( data ) {
							currentSHA = data.SHA;
							console.log( data );
							if( typeof(currentSHA) == "undefined" ) {
								callback( "Can't get client's SHA", null );
							} else {
								callback( null, "Got SHA" );
							}
						});
					},
					function( callback ){ 
						git.checkout( null, null, callback );
					},
					function( callback ){ 
						git.pull( true, callback );
					},
					function( callback ){ 
						var commandString = "git checkout -b EasyGitBranch " + currentSHA;
						exec( commandString, function( error, stdout, stderr ) {
							console.log( commandString );
							console.log('stdout: ' + stdout);
							console.log('stderr: ' + stderr);
							callback( null, stdout );
						});
					},
					function( callback ){ 
						deleteExistingFiles( callback );
					},
					function( callback ){ 
						copyIncomingFiles();
						callback( null, "Unzipped folder into place" );
					},
					function( callback ){
						git.commit( commitMessage, ".", callback );
					},
					function( callback ){ 
						git.checkout( null, "master", callback );
					},
					function( callback ){ 
						git.merge( "EasyGitBranch", callback );
					},
					function( callback ){ 
						git.push( callback );
					},
					function( callback ){ 
						var commandString = "git branch -d EasyGitBranch";
						exec( commandString, function( error, stdout, stderr ) {
							console.log( commandString );
							console.log('stdout: ' + stdout);
							console.log('stderr: ' + stderr);
							callback( null, stdout );
						});
					},
				], function(err, results){
					processDone( err );
						
					console.log( err || results );
				});
			};
		});
	});
}); // end socket on Connection


function startProcess() {
	nextStep = gitCheckout;
	
	callNextStep();
} // end startProcess()


function processDone() {
	console.log( "Process Done!" );
	io.sockets.socket(currentUser).emit( "processDone" );
	isLocked = false;
	currentUser = null;
	commitMessage = null;
}


function callNextStep( error ) {
	if( typeof(error) == "undefined" || error == null ) 
		nextStep();
	else {
		emitError( error );
	}
} // end callNextStep()


function gitCheckout() {
	console.log( "Checking out back to HEAD" );
	nextStep = gitPullRebase;
	
	var child = exec('git checkout -- .', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		
		if( error != null ) {
			callNextStep( stderr );
		} else {
			callNextStep( null );
		}
	});
} // end gitCheckout()


function gitPullRebase( clearAndPullOnly ) {
	console.log( "Pulling from remote" );
	if( clearAndPullOnly ) {
		nextStep = zipDirectory( baseDir, function() {
			console.log( "Zipped directory" );
		});
	} else {
		nextStep = deleteExistingFiles;	
	}
	
	var child = exec('git pull', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		
		if( error != null ) {
			callNextStep( stderr );
		} else {
			callNextStep( null );
		}
	});
} // end gitPullRebase()


// REMOVE THE DIRECTORY RECURSIVELY (scary, I know)
function deleteExistingFiles( callback ) {
	console.log( "Deleting all files within " + baseDir );
	nextStep = copyIncomingFiles;	
	
	if( baseDir.length < 6 ) {
		console.log( "ALMOST DELETED " + baseDir );
		emitError( "Base directory (" + baseDir + ") is too short, do you really want to delete that :/" );
	}
	
	var rmDirFilter = function( file, cb ) {		
		var path;
		
		if( typeof(file) == "string" ) {
			path = file;
		} else if( typeof(file) == "object" ) {
			path = file.path;
		} else {
			console.log( "Unknown type: " + typeof(file) );
			return false;
		}
		
		// Only delete things that don't have "/.git/" in them
		if( typeof(path) == "undefined" || path.indexOf("/.git/") != -1 )
			return false;
		else
			return true;
	}
	
	console.log( "about to remove...hold your breath" );
	
	// REMOVE THE DIRECTORY RECURSIVELY (scary, I know)
	wrench.rmdirRecursive( baseDir, rmDirFilter, callback );
} // end deleteExistingFiles()


function copyIncomingFiles( callback ) {
	console.log( "Unzipping and copying incoming files into place" );
	nextStep = gitPush;
	
	try {
		unzip = new AdmZip( "./temp/" + fileName );
	} catch( err ) {
		console.log( "Couldn't open zipped directory: " + err );
	}
	
	// Extract all files 
	unzip.extractAllTo( baseDir, true );
    
	//if( typeof(callback) != "undefined" ) { callNextStep(); }
} // end copyIncomingFiles()


function gitCommit() {
	console.log( "Committing files to git" );
	
	if( typeof(commitMessage) == "undefined" ) 
		commitMessage = "Files changed using EasyGit";
	
	exec('git commit -m "' + commitMessage + '" -- ' + baseDir, function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		
		if( error != null ) {
			callNextStep( stderr );
		} else {
			callNextStep( null );
		}
	});
}


function gitPush() {	
	console.log( "Pushing changes to git" );
	/*
	exec('git status', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		if (error !== null) {
			console.log(error);
		} else {
			console.log( "Success!" );
			processDone();
		}
	});
	*/
	exec('git push origin master', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		if (error !== null) {
			emitError(error);
		} else {
			console.log( "Success!" );
			processDone();
		}
	});
} // end gitPush()


function emitError( error ) {
	io.sockets.socket( currentUser ).emit( "transferError", {error: error} );
	console.log( "Error: " + error );
	
	isLocked = false;
	currentUser = null;
	commitMessage = null;
}


function dirExistsSync( d ) {
	try { fs.statSync( d ).isDirectory() }
	catch( er ) { return false }
} // end dirExistsSync()

function getFileNameFromPath( fullPath ) {
	var lastBackSlash = fullPath.lastIndexOf( "\\" ),
		lastForwardSlash = fullPath.lastIndexOf( "/" );
		
	var folderStart = lastBackSlash > lastForwardSlash ? lastBackSlash : lastForwardSlash;

	return fullPath.substring( folderStart + 1 );
}

function getBaseDirFromFilePath( filePath ) {
	var lastBackSlash = fullPath.lastIndexOf( "\\" ),
		lastForwardSlash = fullPath.lastIndexOf( "/" );
		
	var lastfolderStart = lastBackSlash > lastForwardSlash ? lastBackSlash : lastForwardSlash;

	return fullPath.substring( 0, lastfolderStart + 1 );
}


function zipDirectory( dir, callback ) {
	var archive = new zipper();
	
	console.log( "Starting to zip" );
	console.log( dir );

	// map all files in the approot thru this function
	folder.mapAllFiles(dir, function (path, stats, callback) {		
		if( path.indexOf(".git") != -1 ) return callback();
		
		// Figure out the base directory for all of these files
		var baseDir = getFolderName(dir);
		
		var afterBaseIndex = path.indexOf(baseDir) + baseDir.length + 1;
		
		var callbackParams = {
			//name: path.replace(dir, "").substr(1), 
			name: path.substring(afterBaseIndex, path.length),
			path: path 
		};
		
		console.log( callbackParams );
	
		// prepare for the .addFiles function
		callback( callbackParams );
	}, function (err, data) {
		if (err) return callback(err);

		// add the files to the zip
		archive.addFiles(data, function (err) {
			if (err) return callback(err);

			// write the zip file
			console.log( "writing zip file to " + dir );
			fs.writeFile(dir + ".zip", archive.toBuffer(), function ( err ) {
				if (err) return callback(err);

				callback(null, dir + ".zip");
			});
		});
	});   
} // end zipDirectory()


//////////////////////////////////////////////////////////////////////////
// Returns the folder from a full filepath
function getFolderName( fullPath ) {
	var lastBackSlash = fullPath.lastIndexOf( "\\" ),
		lastForwardSlash = fullPath.lastIndexOf( "/" ),
		isForwardSlash;
		
	// Figure out whether we're working with a forward or backward slash
	if( lastBackSlash > lastForwardSlash ) {
		lastSlash = lastBackSlash;		
		isForwardSlash = false;
	} else {
		lastSlash = lastForwardSlash;		
		isForwardSlash = true;
	}
	
	// Pull off any file thats on the end
	if( fullPath.indexOf(".") != -1 ) {
		fullPath= fullPath.substring( 0, lastSlash );
		lastSlash = isForwardSlash ? fullPath.lastIndexOf( "/" ) : fullPath.lastIndexOf( "\\" );
	}
	
	// Make sure the last slash isn't at the end of the string
	if( lastSlash == fullPath.length - 1 ) {
		fullPath= fullPath.substring( 0, fullPath.length - 1 );
		lastSlash = isForwardSlash ? fullPath.lastIndexOf( "/" ) : fullPath.lastIndexOf( "\\" );
	}
	
	return fullPath.substring( lastSlash + 1 );
} // end getFolderName()


function getOneFolderUp( folderPath ) {
	var folderName = getFolderName( folderPath );
	
	return folderPath.substring( 0, folderPath.indexOf(folderName) );	
}
