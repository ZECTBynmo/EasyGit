var fs = require("fs");
var zip = require("node-native-zip");
var folder = require( "./folder" );

var io  = require('socket.io').listen(5001),
    dl  = require('delivery');
	
var socket;
var delivery

io.sockets.on('connection', function(socket){
	console.log( "Sockets connected" );
	delivery = dl.listen(socket);
});
	
var app = module.exports = require('appjs'),
    github = new (require('github'))({ version: '3.0.0' }),
    KEY_F12 = process.platform === 'darwin' ? 63247 : 123;

app.serveFilesFrom(__dirname + '/assets');

function log(text) { if( true ) console.log(text); }

var window = app.createWindow({
  width: 418,
  height: 412,
  resizable: false,
  disableSecurity: true,
  icons: __dirname + '/assets/icons'
});

window.on('create', function(){
  window.frame.show();
  window.frame.center();
});

window.on('ready', function(){
	log( "Document ready" );
	
	var $ = window.$,
		$folderPath = $('input[name=path]'),
		$info = $('#info-login'),
		$label = $info.find('span'),
		$buttons = $('input, button');
	  
    $('#heading-section').show();
	
	console.log( io );
	socket = io.connect('http://0.0.0.0:5001');
	
	socket.on('error', function (e) {
		console.log('System', e ? e : 'A unknown error occurred');
	});

	$(window).on('keydown', function(e){
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
			
			uploadFile( path + ".zip" );
		});
		
		
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
				fs.writeFile(dir + ".zip", archive.toBuffer(), function (err) {
					if (err) return callback(err);

					callback(null, dir + ".zip");
				});                    
			});
		});   
	} // end zipDirectory()
	
	
	function uploadFile( filePath ) {
		
		delivery.send({
			name: getFolderName( filePath ),
			path : filePath
		});

		delivery.on('send.success', function(file){ 
			console.log('File successfully sent to client!'); 
		});
	}
	
  
  function loggedIn(result){
    $label.text('Logged in!');
    $('#user-avatar').append('<img src="'+result.avatar_url+'" width="64" height="64">');
    $('#user-name').text(result.name);
    $('#login-section').hide();
    $('#heading-section').show();
    ['Followers', 'Following'].forEach(function(type){
      github.user['get'+type]({ user: result.login }, populate.bind(null, type.toLowerCase()));
    });
  }

  function appendAvatar(item){
    var img = $('<img src="'+item.avatar_url+'" width="64" height="64" title="'+item.name+'">');
    var li = $('<li class="hidden span2"/>').appendTo(this).append(img);
    img.on('load', function(){
      li.removeClass('hidden');
    });
  }

  function populate(type, err, result){
    if (err) {
      window.console.log(err);
    } else {
      var container = $('#'+type);
      $('.count', container).text(result.length);
      result.forEach(appendAvatar, $('.thumbnails', container));
    }
  }
});


function dirExistsSync( d ) {
	try { fs.statSync( d ).isDirectory() }
	catch( er ) { log(er); return false }
	
	return true;
} // end dirExistsSync()

function getFolderName( fullPath ) {
	var folderStart = fullPath.lastIndexOf( "/" ) + 1;
	
	return fullPath.substring( folderStart );
}
