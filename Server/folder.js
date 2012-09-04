var exec = require("child_process").exec;

var NativeFs = require("fs");
var fs = require("./throttle-fs");
var path = require("path");
var async = require("async");

// cp -r . ../jaja
/**
 * Copy the content of a folder and all it's subfolder to a new folder
 */
function copyFolder(src, target, callback) {
    src = path.resolve(src);
    target = path.resolve(target);
    
    var command = 'cp -r . "' + target + '"';
    
    exec(command, {cwd: src}, function (err, stdout, stderr) {
        if (err || stderr) return callback(err || stderr);
        
        callback(null);
    });
}

/**
 * Mapping function on all files in a folder and it's subfolders
 * @param dir {string} Source directory
 * @param action {Function} Mapping function in the form of (path, stats, callback), where callback is Function(result)
 * @param callback {Function} Callback fired after all files have been processed with (err, aggregatedResults)
 */
function mapAllFiles(dir, action, callback, concurrency) {
    var output = [];
    
    // create a queue object with concurrency 2
    var q = async.queue(function (filename, next) {
        NativeFs.stat(filename, function (err, stats) {
            if (err) return next(err);
            
            if (stats.isDirectory()) {
                readFolder(filename, next);
            }
            else {
                action(filename, stats, function (res) {
                    if (res) {
                        output.push(res);
                    }
                    
                    next();
                });                
            }
        });
    }, concurrency || 5);
    
    // read folder and push stuff to queue
    function readFolder (dir, next) {
        NativeFs.readdir(dir, function (err, files) {
            if (err) return next(err);
            
            q.push(files.map(function (file) {
                return path.join(dir, file);
            }));
            
            next();
        });
    };
    
    readFolder(dir, function () {
        // on drain we're done
        q.drain = function (err) {
            callback(err, output);
        };
    });
};


/**
 * Copy one file
 */
function copyFile(src, target, callback) {
    // is there a native copyFile available? use that, otherwise do it ourselves
    if (fs.copyFile) {
        fs.copyFile(src, target, callback);
    }
    else {
        var srcFile = fs.createReadStream(src);
        var targetFile = fs.createWriteStream(target);
        
        targetFile.on("close", function () {
            callback(null, src);        
        });
        
        srcFile.pipe(targetFile);
    }
}

/**
 * Do a recursive remove on a folder and all it's subfolders
 */
function rmrf(dir, callback) {
    fs.stat(dir, function(err, stats) {
        if (err) {
            return callback(err);
        }

        if (!stats.isDirectory()) {
            return fs.unlink(dir, callback);
        }

        var count = 0;
        fs.readdir(dir, function(err, files) {
            if (err) {
                return callback(err);
            }

            if (files.length < 1) {
                return fs.rmdir(dir, callback);
            }

            files.forEach(function(file) {
                var sub = path.join(dir, file);

                rmrf(sub, function(err) {
                    if (err) {
                        return callback(err);
                    }

                    if (++count == files.length) {
                        fs.rmdir(dir, callback);
                    }
                });
            });
        });
    });
}

module.exports = { copy: copyFolder, remove: rmrf, mapAllFiles: mapAllFiles, copyFile: copyFile };
