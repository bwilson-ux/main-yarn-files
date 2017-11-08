var path                = require('path'),
    readFile            = require('fs').readFileSync,
    exists              = require('path-exists').sync,
    stripJsonComments   = require('strip-json-comments'),
    extend              = require('extend'),
    Package             = require('./package'),
    logger              = require('./logger');

/**
 * Collection for bower packages
 *
 * @class PackageCollection
 */

/**
 * @constructor
 * @param {Object} opts
 */
function PackageCollection(opts) {
    this.opts               = opts;
    this.opts.main          = opts.main || null;
    this.opts.env           = opts.env || process.env.NODE_ENV;
    this.debugging          = opts.debugging || false;
    this.overrides          = opts.overrides || {};
    this._queue             = [];
    this._lastQueueLength   = 0;
    this._packages          = {};
    this._processed         = {};

    this.collectPackages();
}

PackageCollection.prototype = {
    /**
     * Adds a package to the collection
     *
     * @param {String} name Name of the package
     * @param {String} path Path to the package files
     */
    add: function(name, path, main) {
        if (this._packages[name]) {
            return;
        }

        if (this.debugging) {
            logger('PackageCollection', 'add', name, path);
        }

        this._packages[name] = true;

        var opts = this.overrides[name] || {};
        opts.name = name;
        opts.path = path;
        if (path.indexOf(this.opts.paths.bowerDirectory) === -1) {
            opts.main = main || name;
        }
        opts.path = path;

        this._packages[name] = new Package(opts, this);
    },

    /**
     * Collects all packages
     */
    collectPackages: function() {
        if (!exists(this.opts.paths.bowerJson)) {
            throw new Error('bower.json does not exist at: ' + this.opts.paths.bowerJson);
        }

        var includeDev = this.opts.includeDev || false,
            includeSelf = this.opts.includeSelf || false;

        try {
            var bowerJson = JSON.parse(stripJsonComments(readFile(this.opts.paths.bowerJson, 'utf8'))),
                devDependencies = bowerJson.devDependencies || {},
                dependencies = bowerJson.dependencies || {},
                main = bowerJson.main || {};
        }  catch(err) {
            console.error(err + ' in file ' + this.opts.paths.bowerJson);
            return
        };

        includeDev = includeDev === true ? 'inclusive' : includeDev;

        this.overrides = extend(bowerJson.overrides || {}, this.overrides);


        //include devDependencies in two ways
        //`inclusive` or `true` to add the devDependencies to dependencies
        //`exclusive` to exclude dependencies

        if (includeDev !== 'exclusive') {
            this.addDependencies(dependencies, bowerJson);
        }

        if (includeDev !== false) {
            this.addDependencies(devDependencies, bowerJson);
        }

        // Add the main files to project dependencies
        if (includeSelf !== false) {
            this.add(bowerJson.name || 'self', path.dirname(this.opts.paths.bowerJson), main);
        }
    },

    /**
     * Adds all dependencies
     * @param dependencies
     * @param bowerJson
     */
    addDependencies: function (dependencies, bowerJson) {
        if (typeof dependencies !== "string") {
            for (var name in dependencies) {
                this.add(name, path.join(this.opts.paths.bowerDirectory, path.sep, name));
            }
        } else {
            this.add(dependencies, path.join(path.dirname(this.opts.paths.bowerJson)));
        }
    },


    /**
     * Get srcs of all packages
     *
     * @return {Array}
     */
    getFiles: function() {
        for (var name in this._packages) {
            this._queue.push(this._packages[name]);
        }

        return this.process();
    },

    /**
     * processes the queue and returns the srcs of all packages
     *
     * @private
     * @return {Array}
     */
    process: function() {
        var queue = this._queue,
            srcs = [],
            force = false;

        if (this._lastQueueLength === queue.length) {
            force = true;
        }

        this._lastQueueLength = queue.length;

        this._queue = [];

        queue.forEach(function(package) {
            var packageSrcs = package.getFiles(force);

            if (packageSrcs === false) {
                return this._queue.push(package);
            }

            srcs.push.apply(srcs, packageSrcs);
            this._processed[package.name] = true;
        }, this);

        if (this._queue.length) {
            srcs.push.apply(srcs, this.process());
        }

        return srcs;
    }
};

module.exports = PackageCollection;
