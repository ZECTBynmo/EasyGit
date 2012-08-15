var port = typeof( process.env.PORT ) == "undefined" ? 2323 : process.env.PORT;

var io  = require('socket.io');
io.listen(port);

var fs = require("fs");
var httpServer = require("./HTTPServer").createNewServer( port, null );
var exec = require('child_process').exec
var wrench = require("wrench");

var AdmZip = require('adm-zip');
var zip; 

// To be determined later
var baseDir;
var fileData;

// This will hold the function that we're going to call next. It
// makes our very asynchronous code cleaner.
var nextStep = function() {};


httpServer.on( "/updateDirectory", function( data ) {
	baseDir = data.baseDir;
	fileData = data.fileZip;
    
	// Make sure it exists on this computer
	if( !dirExistsSync(baseDir) ) {
		console.log( "Error: The directory " + baseDir + " does not exist" );
		return;
	}
	
	startProcess();
}); // end on updateDirectory


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


function writeZipToDisk( callback ) {
    var stream = fs.createWriteStream("tempArchive.zip");
    
    stream.once('open', function(fd) {
        stream.write( fileData );
    });

    callback();
} // end writeZipToDisk()


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