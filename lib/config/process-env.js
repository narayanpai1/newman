var _ = require('lodash'),

    /**
     * List of options with env-support for each command.
     *
     * Each option with env-support is mapped to an environment variable with
     * prefix 'POSTMAN_' followed by the option in capitalised snakecase
     */
    config = {
        run: []
    },

    /**
     * Gets the option corresponding to an env-variable.
     * Eg: POSTMAN_ALIAS -> alias
     *
     * @param {String} envVar - The environment variable
     * @returns {String} The option
     */
    getOption = (envVar) => {
        envVar = envVar.replace(/^POSTMAN_/, '');

        return _.camelCase(envVar);
    };

module.exports.load = (callback) => {
    let envConfig = {};

    _.forIn(config, (envVars, command) => {
        let commandOptions = envVars.reduce((obj, envVar) => {
            let key = getOption(envVar),
                // eslint-disable-next-line no-process-env
                value = _.get(process.env, envVar);

            value && (_.set(obj, key, value));

            return obj;
        }, {});

        _.set(envConfig, command, commandOptions);
    });

    return callback(null, envConfig);
};
