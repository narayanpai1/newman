var _ = require('lodash'),
    async = require('async'),

    env = require('./process-env'),
    rcfile = require('./rc-file'),
    defaults = require('./defaults'),

    ALIAS = 'alias',
    DEFAULT = 'default';

/**
 * Reads configuration from config file, environment variables and CLI arguments. The CLI arguments override environment
 * variables and environment variables override the configuration read from a file.
 *
 * @param {Object} overrides - Configuration overrides (these usually come from the CLI).
 * @param {Object} options - The wrapper object of settings used for selective configuration loading.
 * @param {String} options.command - Command name. Used for loading the required options from the config file.
 * @param {Boolean=} options.ignoreRcFile - If true, the RC file is ignored.
 * @param {Boolean=} options.ignoreProcessEnvironment - If true, the process environment variables are ignored.
 * @param {Object=} options.loaders - Custom loaders for specific configuration options.
 * @param {Function} callback - Is called after merging values from the overrides with the values from the rc file and
 * environment variables.
 * @returns {*}
 */
module.exports.get = (overrides, options, callback) => {
    let { loaders, command } = options;

    async.parallel([
        // load default options for CLI if
        overrides.rawArgs ? defaults.loadCLI : (cb) => {
            return cb(null, {});
        },
        // Load RC Files.
        !options.ignoreRcFile ? rcfile.loadAll : (cb) => {
            return cb(null, {});
        },
        // Load Process Environment overrides
        !options.ignoreProcessEnvironment ? env.load : (cb) => {
            return cb(null, {});
        }
    ], (err, options) => {
        if (err) {
            return callback(err);
        }

        // get auth-related details from options fetched from rc file
        let authOptions = options[0].login,
            commonOptions;

        // get options specific to the command
        options = _.map(options, (obj) => {
            return obj && obj[command] ? obj[command] : {};
        });

        // merge the options from all the sources
        options = _.mergeWith({}, ...options, overrides, (dest, src) => {
            // If the newer value is a null, do not override it.
            return (src === null) ? dest : undefined;
        });

        authOptions && authOptions._profiles &&
            (options.user = _.filter(authOptions._profiles, [ALIAS, options.alias || DEFAULT])[0]);

        if (_.isEmpty(loaders)) {
            return callback(null, options);
        }
        // sanitize environment option
        if (!options.environment) {
            options.environment = {};
        }
        // sanitize globals option
        if (!options.globals) {
            options.globals = {};
        }

        commonOptions = {
            // preserve the reference as the object can be mutated to store decrypted/decoded API key
            user: options.user // might be undefined as well
        };

        async.mapValues(options, (value, name, cb) => {
            return (value && _.isFunction(loaders[name])) ? loaders[name](value, commonOptions, cb) : cb(null, value);
        }, callback);
    });
};
