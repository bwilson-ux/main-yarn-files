var path                = require('path'),
    readFile            = require('fs').readFileSync,
    exists              = require('path-exists').sync,
    stripJsonComments   = require('strip-json-comments'),
    extend              = require('extend'),
    Package             = require('./package'),
    logger              = require('./logger');

/**
 * Collection for Yarn packages
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
        if (path.indexOf(this.opts.paths.modulesFolder) === -1) {
            opts.main = main || name;
        }
        opts.path = path;

        this._packages[name] = new Package(opts, this);
    },

    /**
     * Collects all packages
     */
    collectPackages: function() {
        if (!exists(this.opts.paths.jsonFile)) {
            throw new Error('package.json does not exist at: ' + this.opts.paths.jsonFile);
        }

        try {
            var jsonFile        = JSON.parse(stripJsonComments(readFile(this.opts.paths.jsonFile, 'utf8'))),
                dependencies    = jsonFile.dependencies || {};
        }  catch(err) {
            console.error(err + ' in file ' + this.opts.paths.jsonFile);
            return;
        }

        this.overrides = extend(jsonFile.overrides || {}, this.overrides);
        this.addDependencies(dependencies);

    },

    /**
     * Adds all dependencies
     * @param dependencies
     */
    addDependencies: function (dependencies) {
        if (typeof dependencies !== "string") {
            for (var name in dependencies) {
                if(name.indexOf(this.opts.scope) > -1){
                    name = name.replace(this.opts.scope + '/','');
                }
                this.add(name, path.join(this.opts.paths.modulesFolder, path.sep, name));
            }
        } else {
            this.add(dependencies, path.join(path.dirname(this.opts.paths.jsonFile)));
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
