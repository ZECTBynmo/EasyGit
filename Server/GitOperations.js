//////////////////////////////////////////////////////////////////////////
// GitOperations - main home for git related activities
//////////////////////////////////////////////////////////////////////////
//
// We interface with git using the command line.
/* ----------------------------------------------------------------------
													Object Structures
-------------------------------------------------------------------------
	
*/
var exec = require('child_process').exec;

//////////////////////////////////////////////////////////////////////////
// Push our current state to the server
exports.push = function( callback ) {	
	console.log( "Pushing changes to git" );

	exec('git push origin master', function ( error, stdout, stderr ) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callback( stderr, stdout );
	});
} // end push()


//////////////////////////////////////////////////////////////////////////
// Pull the current state of the server down to our local repository
exports.pull = function( isRebase, callback ) {	
	console.log( "Pulling changes " + isRebase ? "with rebase" : "without rebase" );
	
	var commandString = isRebase ? "git pull --rebase" : "git pull";

	exec( commandString, function( error, stdout, stderr ) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callback( stderr, stdout );
	});
} // end pull()


//////////////////////////////////////////////////////////////////////////
// Return our local repository state back to the last time we pulled from the server
exports.checkout = function( filePath, callback ) {	
	console.log( "Checking out" );
	var path;
	if( typeof(filePath) == "undefined" || filePath == null ) {
		path = ".";
	} else {
		path = filePath;
	}

	var commandString = "git checkout -- " + path;
	
	exec( commandString, function( error, stdout, stderr ) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callback( stderr, stdout );
	});
} // end checkout()


//////////////////////////////////////////////////////////////////////////
// Push our current state to the server
exports.commit = function( commitMessage, location, callback ) {	
	console.log( "Committing changes in " + location );
	
	var commandString = 'git commit -m "' + commitMessage + '" ' + location;
	
	console.log( commandString );

	exec( commandString, function( error, stdout, stderr ) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		callback( stderr, stdout );
	});
} // end commit()