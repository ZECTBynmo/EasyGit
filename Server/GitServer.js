var fs = require("fs");
var httpServer = require("./HTTPServer").createNewServer();
var exec = require('child_process').exec
var wrench = require("wrench");

// To be determined later
var baseDir;

// This will hold the function that we're going to call next. It
// makes our very asynchronous code cleaner.
var nextStep = function() {};


httpServer.on( "/updateDirectory", function( data ) {
	baseDir = data.baseDir;
	
	// Make sure it exists on this computer
	if( !dirExistsSync(baseDir) ) onFailure();
	
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


function gitCheckout() {
	nextStep = gitPullRebase;
	
	var child = exec('git checkout -- .', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callNextStep( error );
	});
} // end gitCheckout()


function gitPullRebase() {
	nextStep = deleteExistingFiles;	
	
	var child = exec('git pull --rebase', function (error, stdout, stderr) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callNextStep( error );
	});
} // end gitPullRebase()


function deleteExistingFiles() {
	nextStep = copyIncomingFiles;	
	
	// REMOVE THE DIRECTORY RECURSIVELY (scary, I know)
	wrench.rmdirRecursive( baseDir, callNextStep );
} // end deleteExistingFiles()


function copyIncomingFiles() {
	nextStep = gitPush;
	
	ar.openFile( path.join(root, "test.tar.gz"), callNextStep );
} // end copyIncomingFiles()


function gitPush() {	
	var child = exec('git push origin master', function (error, stdout, stderr) {
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