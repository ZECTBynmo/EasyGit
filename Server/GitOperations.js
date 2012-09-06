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
	
	var commandString = "git push origin master";
	runCommand( commandString, callback );
} // end push()


//////////////////////////////////////////////////////////////////////////
// Pull the current state of the server down to our local repository
exports.pull = function( isRebase, callback ) {	
	console.log( "Pulling changes " + isRebase ? "with rebase" : "without rebase" );
	
	var commandString = isRebase ? "git pull --rebase" : "git pull";
	exec( commandString, function( error, stdout, stderr ) {
		if( stderr.indexOf("Current branch master is up to date") ) {
			stdout = stderr;
			stderr = null;
		}
	
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		console.log( commandString );
		callback( null, stdout );
	});
} // end pull()


//////////////////////////////////////////////////////////////////////////
// Return our local repository state back to the last time we pulled from the server
exports.checkout = function( filePath, branch, callback ) {	
	console.log( "Checking out" );
	var pathString;
	if( typeof(filePath) != "undefined" && filePath != null ) {
		pathString = "-- " + filePath;
	} else if( typeof(branch) != "undefined" && branch != null ) {
		pathString = branch;
	} else {
		pathString = "-- .";
	}

	var commandString = "git checkout " + pathString;
	runCommand( commandString, callback );
} // end checkout()


//////////////////////////////////////////////////////////////////////////
// Push our current state to the server
exports.commit = function( commitMessage, location, callback ) {	
	console.log( "Committing changes in " + location );
	
	if( location == null || typeof(location) == "undefined" )
		location = ".";
	
	var commandString = 'git commit -m "' + commitMessage + '" ' + location;
	runCommand( commandString, callback );
} // end commit()


//////////////////////////////////////////////////////////////////////////
// Create a new branch
exports.branch = function( branchName, TagOrSHA, callback ) {	
	console.log( "Creating branch " + branchName );
	
	if( TagOrSHA == null || typeof(TagOrSHA) == "undefined" )
		TagOrSHA = "HEAD";
	
	var commandString = 'git branch ' + branchName + ' ' + TagOrSHA;
	runCommand( commandString, callback );
} // end branch()


//////////////////////////////////////////////////////////////////////////
// Merge the current branch with a specified branch
exports.merge = function( branchName, callback ) {	
	console.log( "Committing changes in " + branchName );
	
	var commandString = "git merge " + branchName;
	runCommand( commandString, callback );
} // end merge()


//////////////////////////////////////////////////////////////////////////
// Returns the current SHA of the local HEAD
exports.getAsyncSHA = function( callback ) {	
	var commandString = "git rev-parse --verify HEAD";
	exec( commandString, function( error, stdout, stderr ) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		console.log( commandString );
		callback( stdout );
	});
} // end getAsyncSHA()


//////////////////////////////////////////////////////////////////////////
// Returns the current SHA of the local HEAD
exports.getAsyncBranch = function( callback ) {	
	var commandString = "git branch";
	exec( commandString, function( error, stdout, stderr ) {
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		console.log( commandString );
		callback( stdout );
	});
} // end getAsyncSHA()


function runCommand( commandString, callback ) {
	exec( commandString, function( error, stdout, stderr ) {
		console.log( commandString );
		console.log('stdout: ' + stdout);
		console.log('stderr: ' + stderr);
		
		var err = stderr.indexOf("fatal") > 0 ? stderr : null;
		
		callback( err, stdout );
	});
} // runCommand()