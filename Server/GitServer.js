var port = typeof( process.env.PORT ) == "undefined" ? 5000 : process.env.PORT;

var fs = require("fs");
var exec = require('child_process').exec
var wrench = require("wrench");

var AdmZip = require('adm-zip');
var unzip; 

// To be determined later
var baseDir;
var fileName; 
var fileData;

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
	
	socket.on( "requestHEAD", function( data ) {
		console.log( "update to HEAD requested" );
		
		var deliveryObj= {
			name: data.fileName,
			path: data.baseDir
		};
		
		console.log( deliveryObj );
		
		if( isLocked ) {
			emitError( "Transfer locked: server busy" );
			return;
		} else {			
			delivery.send( deliveryObj );
			
			delivery.on( 'send.error', function( error ) {
				console.log( error );
				$info.removeClass('success').addClass('error');
				$label.text( 'Error uploading directory: ' + error );
				log( "send error: " + error );
			});
			
			delivery.on( 'send.start', function( filePackage ) {
				$label.text('Uploading zipped directory');
				log(filePackage.name + " is being sent to the client.");
			});

			delivery.on('send.success', function(file){ 
				log('File successfully sent to client!'); 
				$label.text('Directory Uploaded!');
			});		
		}
	});
  
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
				startProcess();
			};
		});
	});	
});


function startProcess() {
	nextStep = gitCheckout;
	
	callNextStep();
} // end startProcess()


function processDone() {
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
	
	var child = exec('git pull --rebase', function (error, stdout, stderr) {
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
function deleteExistingFiles() {
	console.log( "Deleting all files within " + baseDir );
	nextStep = copyIncomingFiles;	
	
	if( baseDir.length < 6 ) {
		console.log( "ALMOST DELETED " + baseDir );
		emitError( "Base directory (" + baseDir + ") is too short, do you really want to delete that :/" );
	}
	
	// REMOVE THE DIRECTORY RECURSIVELY (scary, I know)
	wrench.rmdirRecursive( baseDir, callNextStep );
} // end deleteExistingFiles()


function copyIncomingFiles() {
	console.log( "Unzipping and copying incoming files into place" );
	nextStep = gitPush;
	
	try {
		unzip = new AdmZip( "./temp/" + fileName );
	} catch( err ) {
		console.log( "Couldn't open zipped directory: " + err );
	}
	
	// Extract all files 
	unzip.extractAllTo( baseDir, true );
    
    callNextStep();
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
	var archive = new zip();

	// map all files in the approot thru this function
	folder.mapAllFiles(dir, function (path, stats, callback) {
		// prepare for the .addFiles function
		callback({ 
			name: path.replace(dir, "").substr(1), 
			path: path 
		});
	}, function (err, data) {
		if (err) return callback(err);

		// add the files to the zip
		archive.addFiles(data, function (err) {
			if (err) return callback(err);

			// write the zip file
			fs.writeFile(dir + ".zip", archive.toBuffer(), function ( err ) {
				if (err) return callback(err);

				callback(null, dir + ".zip");
			});
		});
	});   
} // end zipDirectory()