var exists = require('path-exists').sync,
    path = require('path'),
    multimatch = require('multimatch'),
    PackageCollection = require('./package_collection');

module.exports = function (filter, opts, cb) {
    var collection,
        files,
        jsonFile,
        modulesFolder,
        scope,
        cwd = process.cwd(), //Current working directory
        error;

    if (typeof filter === 'function') {
        cb = filter;
        opts = null;
        filter = null;
    } else if (typeof filter !== 'string' && Array.isArray(filter) === false && !(filter instanceof RegExp)) {
        if (typeof opts === 'function') {
            cb = opts;
        }
        opts = filter;
        filter = null;
    } else if (typeof opts === 'function') {
        cb = opts;
        opts = null;
    }

    if (typeof cb !== 'function') {
        cb = null;
    }

    opts = opts || {};
    // Type: Object or String
    // Specify the paths where the following specific files are located:
    // dependencies directory and package.json
    opts.paths = opts.paths || {};

    // Type: RegExp or function or glob Default: null
    // Filter the list of files by a regular expression, glob or callback function (the first and only argument is the file path).
    opts.filter = opts.filter || filter;

    if (typeof opts.paths === 'string') {
        cwd = path.resolve(cwd, opts.paths);
    } else {
        jsonFile = opts.paths.jsonFile;
    }

    //Set location of the package.json file
    jsonFile = opts.paths.jsonFile ? path.resolve(process.cwd(), opts.paths.jsonFile)
        : path.resolve(cwd, jsonFile || 'package.json');

    //Set location of the package.json file
    modulesFolder = path.resolve(process.cwd(), opts.paths.modulesFolder);

    if (!jsonFile || !exists(jsonFile)) {
        error = Error('package.json file does not exist at ' + jsonFile);
        if (cb) {
            cb(error, []);
            return [];
        } else {
            throw error;
        }
    }

    if (!modulesFolder || !exists(modulesFolder)) {
        error = Error('Yarn components directory does not exist at ' + modulesFolder);
        if (cb) {
            cb(error, []);
            return [];
        } else {
            throw error;
        }
    }

    opts.base = opts.base || modulesFolder;
    opts.paths = {
        jsonFile: jsonFile,
        modulesFolder: modulesFolder
    };
    opts.scope = opts.scope || '@bower';

    try {
        collection = new PackageCollection(opts);
        files = collection.getFiles();

        if (typeof opts.filter === 'string' || Array.isArray(opts.filter)) {
            files = multimatch(files, opts.filter, {dot: true});
        } else if (opts.filter instanceof RegExp) {
            files = files.filter(function (file) {
                return opts.filter.test(file);
            });
        } else if (typeof opts.filter === 'function') {
            files = files.filter(opts.filter);
        }
    } catch (e) {
        if (cb) {
            cb(e, []);
            return [];
        } else {
            throw e;
        }
    }

    if (cb) {
        cb(null, files || [])
    }

    return files || [];
};
