var cliOptions = {
    run: {
        reporters: ['cli'],
        color: 'auto',
        apiKeyAlias: 'default'
    }
};

/**
 * Load default options for CLI commands
 *
 * @param {Function} callback - The callback to be invoked after the process
 */
module.exports.loadCLI = (callback) => {
    return callback(null, cliOptions);
};
