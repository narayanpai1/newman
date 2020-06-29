var cliOptions = {
    run: {
        folder: [],
        reporters: ['cli'],
        delayRequest: 0,
        globalVar: 0,
        envVar: 0,
        color: 'auto',
        timeout: 0,
        timeoutRequest: 0,
        timeoutScript: 0
    }
};

/**
 * Load default options for CLI commands
 *
 * @param {Function} callback - The callback to be invoked after the process
 */
module.exports.load = (callback) => {
    return callback(null, cliOptions);
};
