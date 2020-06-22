const _ = require('lodash'),
    waterfall = require('async/waterfall'),
    rcfile = require('../config/rc-file'),

    ALIAS = 'alias',
    DEFAULT = 'default',

    ALIAS_NOT_FOUND = 'Alias not found.',
    SUCCESS_MESSAGE = 'Logout successful.';


/**
 * Removes the API-Key-Alias provided from the rc file located in the HOME_DIR.
 *
 * @param {String} alias - The alias of the API Key
 * @param {Function} callback - The callback to be invoked after the process
 * @returns {*}
 */
module.exports = (alias, callback) => {
    !alias && (alias = DEFAULT);

    waterfall([
        rcfile.load,
        (fileData, next) => {
            let previousData = fileData.login && _.filter(fileData.login._profiles, [ALIAS, alias]);

            if (_.isEmpty(previousData)) {
                return next(new Error(ALIAS_NOT_FOUND));
            }

            fileData.login._profiles = _.reject(fileData.login._profiles, [ALIAS, alias]);

            return next(null, fileData);
        },
        rcfile.store
    ], (err) => {
        if (err) {
            return callback(err);
        }

        console.info(SUCCESS_MESSAGE);

        return callback(null);
    });
};
