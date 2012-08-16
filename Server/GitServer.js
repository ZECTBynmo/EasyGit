var port = typeof( process.env.PORT ) == "undefined" ? 5000 : process.env.PORT;

var fs = require("fs");
var exec = require('child_process').exec
var wrench = require("wrench");

var AdmZip = require('adm-zip');
var zip; 

// To be determined later
var baseDir;
var fileName; 
var fileData;

// This will hold the function that we're going to call next. It
// makes our very asynchronous code cleaner.
var nextStep = function() {};

console.log( "Opening socket on port " + port );
var io  = require( 'socket.io' ).listen(port+1);
var dl = require("delivery");

io.sockets.on('connection', function(socket){
	console.log( "Socket connection" );
  
	var delivery = dl.listen(socket);
	delivery.on('receive.success',function(file){
		var fileNameWithoutPath = getFileNameFromPath( file.name );
		
		fileName = fileNameWithoutPath;
		baseDir = getBaseDirFromFilePath( file.name ) + "temp/";
		
		// Create our temp directory if it doesn't exist already
		if( !dirExistsSync( "temp" ) ) {
			fs.mkdir( "temp" );
		}
		
		fs.writeFile( "temp/" + fileNameWithoutPath ,file.buffer, function(err){
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


function callNextStep( error ) {
	if( typeof(error) == "undefined" || error == null ) 
		nextStep();
	else
		console.log( error );
} // end callNextStep()


function gitCheckout() {
	console.log( "Checking out back to HEAD" );
	nextStep = gitPullRebase;
	
	var child = exec('git checkout -- .', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callNextStep( error );
	});
} // end gitCheckout()


function gitPullRebase() {
	console.log( "Pulling from remote" );
	nextStep = deleteExistingFiles;	
	
	var child = exec('git pull --rebase', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callNextStep( error );
	});
} // end gitPullRebase()


function deleteExistingFiles() {
	console.log( "Deleting all files within " + baseDir );
	nextStep = copyIncomingFiles;	
	
	// REMOVE THE DIRECTORY RECURSIVELY (scary, I know)
//	wrench.rmdirRecursive( baseDir, callNextStep );
} // end deleteExistingFiles()


function copyIncomingFiles() {
	console.log( "Unzipping and copying incoming files into place" );
	nextStep = gitPush;
	
	try {
		zip = new AdmZip("tempArchive.zip");
	} catch( err ) {
		console.log( "Couldn't open zipped directory: " + err );
	}
	
	// Extract all files 
	zip.extractAllTo( baseDir, true );
    
    callNextStep();
} // end copyIncomingFiles()


function gitCommit() {
	console.log( "Committing files to git" );
	
	var commitMessage = "Files changed using EasyGit";
	
	exec('git commit -m "' + commitMessage + '" -- ' + baseDir, function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		if (error !== null) {
			console.log(error);
		} else {
			console.log( "Success!" );
		}
	});
}


function gitPush() {	
	console.log( "Pushing changes to git" );
	
	exec('git push origin master', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		if (error !== null) {
			console.log(error);
		} else {
			console.log( "Success!" );
		}
	});
} // end gitPush()

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