var _ = require('lodash'),
    async = require('async'),

    env = require('./process-env'),
    defaults = require('./defaults'),
    rcfile = require('./rc-file');

/**
 * Reads configuration from config file, environment variables and CLI arguments. The CLI arguments override environment
 * variables and environment variables override the configuration read from a file.
 *
 * @param {Object} overrides - Configuration overrides (these usually come from the CLI).
 * @param {Object} options - The wrapper object of settings used for selective configuration loading.
 * @param {String} options.command - Command name. Used for loading the required options from the config file.
 * @param {Boolean=} options.ignoreRcFile - If true, the RC file is ignored.
 * @param {Boolean=} options.ignoreProcessEnvironment - If true, the process environment variables are ignored.
 * @param {Function} callback - Is called after merging values from the overrides with the values from the rc file and
 * environment variables.
 * @returns {*}
 */
module.exports.get = (overrides, options, callback) => {
    var { command } = options;

    async.parallel([
        defaults.loadCLI,
        // Load RC Files.
        (cb) => {
            if (options.ignoreRcFile) {
                return cb(null, {});
            }

            return rcfile.load({ home: true, project: true }, cb);
        },
        // Load Process Environment overrides
        !options.ignoreProcessEnvironment ? env.load : (cb) => {
            return cb(null, {});
        }
    ], (err, options) => {
        if (err) {
            return callback(err);
        }
        var [rcOptions] = options;

        // get options specific to the command
        options = _.map(options, (obj) => {
            return obj && obj[command] ? obj[command] : {};
        });

        // merge the options from all the sources
        options = _.mergeWith({}, ...options, overrides, (dest, src) => {
            // If the newer value is a null, do not override it.
            return (src === null) ? dest : undefined;
        });

        options._login = rcOptions.login;
        !options.apiKeyAlias && (options.apiKeyAlias = 'default');

        callback(null, options);
    });
};
