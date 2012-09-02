// --------------------------------------------------------------
// GIT Directory
//
// This changes which directory this application will
// commit files to (and change) in your git
// repository. The user will have the ability to change 
// anything within this directory. 
//
// Choose a directory that is small in number and size of files,
// and expect that a client could accidentally wipe it at
// any time (remember, they probably don't know git!).
//
// Suggested use is for folders like YourProject/assets/ or 
// YourProject/resources/ or something like that.
// --------------------------------------------------------------
var GIT_DIRECTORY_TO_MODIFY = "C:/Projects/testrepo";
var LOCAL_FOLDER = "C:/Projects/secondtestrepo/";
// --------------------------------------------------------------			
var currentSHA = readSHA();

var fs = require("fs");
var zip = require("node-native-zip");
var folder = require( "./folder" );

var io = require( 'socket.io-client' );
//var io  = require('socket.io').listen(5001);
var dl  = require('delivery');
	
var socket;
var delivery
	
var readyToTransfer = false;
	
var app = module.exports = require('appjs'),
    github = new (require('github'))({ version: '3.0.0' }),
    KEY_F12 = process.platform === 'darwin' ? 63247 : 123;

app.serveFilesFrom(__dirname + '/assets');

function log(text) { if( true ) console.log(text); }

//////////////////////////////////////////////////////////////////////////
// Create Window
var window = app.createWindow({
  width: 418,
  height: 412,
  resizable: false,
  disableSecurity: true,
  icons: __dirname + '/assets/icons'
});


//////////////////////////////////////////////////////////////////////////
// on create
window.on('create', function(){
	window.frame.show();
	window.frame.center();
});


//////////////////////////////////////////////////////////////////////////
// on ready
window.on('ready', function(){
	log( "Document ready" );
	
	var $ = window.$,
		$folderPath = $('input[name=path]'),
		$commitComment = $('input[name=comment]'),
		$info = $('#info-login'),
		$label = $info.find('span'),
		$buttons = $('input, button');
	  
    $('#heading-section').show();
	
	// We're not connected to the server yet, so assume we can't connect
	$info.removeClass('success').addClass('error');
	$label.text( 'Not connected to server' );
	$buttons.attr('disabled', true);
	
	socket = io.connect('http://localhost:5001');
	
	socket.on( 'error', function (e) {
		console.log("error");
		console.log('System', e ? e : 'A unknown error occurred');
		$buttons.attr('disabled', true);
		$info.removeClass('success').addClass('error');
		$label.text( "Socket error: " + e );
	});
	
	socket.on( "gitCheckout", function() {
		log( "got gitCheckout" );
		
		$label.text( 'Clearing server state (git checkout -- .)' );
		$info.removeClass('error').addClass('success');
	});
	
	socket.on( "gitPull", function() {
		log( "got gitPull" );
		
		$label.text( 'Updating server to current repo state (git pull --rebase)' );
		$info.removeClass('error').addClass('success');
	});
	
	socket.on( "deletingDir", function() {
		log( "got deletingDir" );
		
		$label.text( 'Deleting all files in the directory on the server' );
		$info.removeClass('error').addClass('success');
	});
	
	socket.on( "copyingFiles", function() {
		log( "got copyingFiles" );
		
		$label.text( 'Copying your files into place' );
		$info.removeClass('error').addClass('success');
	});
	
	socket.on( "gitCommit", function() {
		log( "got gitCommit" );
		
		$label.text( 'Committing changed files (git commit)' );
		$info.removeClass('error').addClass('success');
	});
	
	socket.on( "gitPush", function() {
		log( "got gitPush" );
		
		$label.text( 'Pushing changes to server (git push origin master)' );
		$info.removeClass('error').addClass('success');
	});
	
	socket.on( "transferError", function( data ) {
		log( "got transferError" );
		
		$label.text( 'Error: ' + data.error );
		$info.removeClass('success').addClass('error');
		$buttons.attr( 'disabled', false );
	});
	
	socket.on( 'connect', function() {
		log( "Sockets connected" );
			
		delivery = dl.listen( socket );
		delivery.connect();
		
		/*
		delivery.on('delivery.connect',function(delivery) {
			log( "Delivery connected" );
		});
		*/
		
		$info.removeClass('success').addClass('error');
		$label.text( 'Connected, waiting for transfer setup...' );
		
		/*
		$label.text( 'Connected and ready!' );
		$info.removeClass('error').addClass('success');
		$buttons.attr( 'disabled', false );
		*/
		
		
		delivery.on('delivery.connect',function(delivery) {
			log( "Delivery Ready!" );
			readyToTransfer = true;
			$label.text( 'Connected and ready!' );
			$info.removeClass('error').addClass('success');
			$buttons.attr( 'disabled', false );
		});
		
		
		delivery.on('receive.success',function(file){
			console.log( "Got a file" );
			var fileNameWithoutPath = getFileNameFromPath( file.name );
			
			fileName = fileNameWithoutPath;
			
			var saveLocation = LOCAL_FOLDER + "temp/";
			
			// Create our temp directory if it doesn't exist already
			if( !dirExistsSync( saveLocation ) ) {
				fs.mkdir( saveLocation );
			}
			
			fs.writeFile( saveLocation + fileNameWithoutPath, file.buffer, function( err ) {
				if( err ) {
					console.log( 'File could not be saved: ' + err );
				} else {
					console.log( 'File ' + file.name + " saved" );
				};
			});
		});			
	});

	$(window).on( 'keydown', function(e){
		if (e.keyCode === KEY_F12) {
			window.frame.openDevTools();
		}
	});

	$folderPath.focus();

	$('#path-form').submit(function(e){
		log( "Button Pressed" );
		e.preventDefault();
		
		$buttons.attr('disabled', true);
		$info.removeClass('error').addClass('success');
		
		var path = $folderPath.val();
		var commitComment = $commitComment.val();
		
		// Verify the directory we're going to upload
		if( verifyDirectory(path) ) {		
			$label.text('Directory verified');
		} else {
			$info.removeClass('success').addClass('error');
			$label.text( 'Error Invalid directory: ' + path );
			$buttons.attr( 'disabled', false );
			return;
		}
		
		// Zip the directory
		zipDirectory( path, function() {
			log( "Zip file created at " + path );
			$label.text( "Zip file created at " + path );
			
			uploadFile( path + ".zip", commitComment );
		});
	});
	
	$('#pull-button').click(function( ) {
		var fileName = "testrepo.zip";
		console.log( fileName );
		var data = {
			fileName: fileName,
			baseDir: GIT_DIRECTORY_TO_MODIFY
		};
		socket.emit( "requestHEAD", data );
	});

	function verifyDirectory( path ) {
		log( "verifying " + path );
		$label.text( 'Verifying directory...' );
		
		if( path.length > 6 && dirExistsSync(path) ) {
			log( "valid directory" );
			return true;
		} else {
			log( "invalid directory" );
			return false;
		}
	} // end verifyDirectory()
	
	
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
	
	
	function uploadFile( filePath, commitMessage ) {
		log( "Uploading file to server: " + filePath );
		
		var fileName = getFolderName( filePath );
		
		var transferTraits = {
			baseDir: GIT_DIRECTORY_TO_MODIFY,
			commitMessage: commitMessage
		};
		
		// Tell the server we're about to transfer
		socket.emit( "requestTransfer", transferTraits );
		
		socket.on( "transferAccepted", function() {
		
			delivery.send({
				name: fileName,
				path: filePath
			});
			
			delivery.on( 'send.error', function( error ) {
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
		});
	} // end uploadFile()
});


//////////////////////////////////////////////////////////////////////////
// Returns whether a directory exists on disk
function dirExistsSync( d ) {
	try { fs.statSync( d ).isDirectory() }
	catch( er ) { log(er); return false }
	
	return true;
} // end dirExistsSync()


//////////////////////////////////////////////////////////////////////////
// Returns the folder from a full filepath
function getFolderName( fullPath ) {
	var lastBackSlash = fullPath.lastIndexOf( "\\" ),
		lastForwardSlash = fullPath.lastIndexOf( "/" );
	
	/*
	if( lastBackSlash == fullPath.length-1 || lastForwardSlash == fullPath.length-1 ) {
		fullPath= fullPath.substring( 0, fullPath.length-1 );
		
		lastBackSlash = fullPath.lastIndexOf( "\\" );
		lastForwardSlash = fullPath.lastIndexOf( "/" );
	}
	*/
		
	var folderStart = lastBackSlash > lastForwardSlash ? lastBackSlash : lastForwardSlash;

	return fullPath.substring( folderStart + 1 );
} // end getFolderName()


//////////////////////////////////////////////////////////////////////////
// Write a git SHA to a text file
function writeSHA( currentSHA ) {
	// See whether the file exists already
	try { stats = fs.lstatSync('./currentSHA.txt'); }
	catch( e ) { console.log(e); }
	
	var fs = require('fs');
	var stream = fs.createWriteStream("./currentSHA.txt");
	stream.once('open', function(fd) {
	  stream.write( currentSHA ); 
	});
} // end writeSHA()


//////////////////////////////////////////////////////////////////////////
// Write a git SHA from disk
function readSHA() {

} // end readSHA()


function getFileNameFromPath( fullPath ) {
	var lastBackSlash = fullPath.lastIndexOf( "\\" ),
		lastForwardSlash = fullPath.lastIndexOf( "/" );
		
	var folderStart = lastBackSlash > lastForwardSlash ? lastBackSlash : lastForwardSlash;

	return fullPath.substring( folderStart + 1 );
}