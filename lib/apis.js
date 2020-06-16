let _ = require('lodash'),
    url = require('url'),
    liquidJSON = require('liquid-json'),
    request = require('postman-request'),
    readline = require('readline'),
    Writable = require('stream').Writable,

    version = require('../package.json').version,
    crypt = require('./crypt'),


    POSTMAN_API_HOST = 'api.getpostman.com',
    POSTMAN_API_URL = 'https://' + POSTMAN_API_HOST,

    /**
     * Map of resource type to its equivalent API pathname.
     *
     * @type {Object}
     */
    POSTMAN_API_PATH_MAP = {
        collection: 'collections',
        environment: 'environments'
    },

    API_KEY_HEADER = 'X-Api-Key',

    USER_AGENT_VALUE = `Newman/${version}`,

    // Matches valid Postman UID or ID, case insensitive.
    // eslint gives an error since matching takes exponential time but it can be ignored in this case
    // eslint-disable-next-line security/detect-unsafe-regex
    ID_REGEX = /^([0-9A-Z]+-)?[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i,

    defaultHeaders = {
        'User-Agent': USER_AGENT_VALUE
    },

    defaultArgs = {
        json: true,
        // Temporary fix to fetch the collection from https URL on Node v12
        // @todo find the root cause in postman-request
        // Refer: https://github.com/postmanlabs/newman/issues/1991
        agentOptions: {
            keepAlive: true
        }
    },

    NO_AUTHORIZATION_DATA = 'No authorization data found.',
    PASSKEY_INPUT_PROMPT = 'Enter the passkey: ',
    INVALID_INPUT = 'Invalid input.',
    ERROR_DECRYPTION = 'Error during decryption',
    INCORRECT_KEY = 'Make sure the key entered is correct.',

    /**
     * Gets the API key if required, from the user profile after decrypting or decoding.
     *
     * If there is a need for decryption, gets the passkey from shell interaction.
     *
     * @param {String} location - Can be an HTTP URL, UID or Postman ID associated with the resource
     * @param {User|undefined} user - Object consisting of user details for authenticating requests
     * @param {Function} cb - The callback to be invoked after the process
     */
    getApiKey = (location, user, cb) => {
        // if the url contains 'apikey' query parameter or
        // the rawApiKey is already available due to previous requests, then return
        if ((/.*apikey?=.*/).test(location) || (user && user.rawApiKey)) {
            return cb(null);
        }

        if (!user) {
            return cb(new Error(NO_AUTHORIZATION_DATA));
        }

        console.info(`Using profile: ${user.alias}`);

        if (!user.encrypted) {
            user.rawApiKey = crypt.decode(user.postmanApiKey);

            return cb(null);
        }

        let mutableStdout = new Writable({
                write (chunk, encoding, callback) {
                    if (!this.muted) { process.stdout.write(chunk, encoding); }
                    callback();
                }
            }),
            rl = readline.createInterface({
                input: process.stdin,
                output: mutableStdout,
                terminal: true
            });

        rl.question(PASSKEY_INPUT_PROMPT, (answer) => {
            mutableStdout.muted = false; // resume the stdout output
            mutableStdout.write('\n'); // go to next line after the user input
            rl.close();

            if (!answer) {
                return cb(new Error(INVALID_INPUT));
            }

            try {
                user.rawApiKey = crypt.decrypt(user.postmanApiKey, answer);
            }
            catch (e) {
                let err = new Error(ERROR_DECRYPTION);

                return cb(_.set(err, 'help', INCORRECT_KEY));
            }

            return cb(null);
        });
        mutableStdout.muted = true; // hide the user input as soon as the prompt is shown
    };

/**
 * Object consisting of user details for authenticating requests.
 *
 * @typedef {Object} User
 * @property {String} alias - The name of the user profile
 * @property {String} postmanApiKey - The encoded or encrypted API Key of the user
 * @property {Boolean} encrypted - Boolean variable specifying if the API Key is encrypted
 * @property {String} [rawApiKey] - The raw API key of the user cached after previous requests
 */

module.exports = {
    /**
     * Regular expression for Postman-UID or Postman-ID
     *
     * @type {RegExp}
     */
    idRegex: ID_REGEX,

    /**
     * Gets resources from the given location.
     *
     * @param {String} type - The type of the Postman resource to load
     * @param {String} location - Can be an HTTP URL, UID or Postman ID associated with the resource
     * @param {User|undefined} user - Object consisting of user details for authenticating requests
     * @param {Function} callback - The callback to be invoked after fetching the resource
     * @returns {*}
     */
    getResource: (type, location, user, callback) => {
        getApiKey(location, user, (err) => {
            if (err) { return callback(err); }

            var headers = {};

            user && (headers[API_KEY_HEADER] = user.rawApiKey);

            // build API URL if `location` is a valid Postman-UID or Postman-ID
            if (POSTMAN_API_PATH_MAP[type] && ID_REGEX.test(location)) {
                location = `${POSTMAN_API_URL}/${POSTMAN_API_PATH_MAP[type]}/${location}`;
            }

            // Load from URL
            request.get({
                ...defaultArgs,
                url: location,
                headers: {
                    ...defaultHeaders,
                    ...headers
                }
            }, (err, response, body) => {
                if (err) {
                    return callback(_.set(err, 'help', `unable to fetch data from url "${location}"`));
                }

                try {
                    _.isString(body) && (body = liquidJSON.parse(body.trim()));
                }
                catch (e) {
                    return callback(_.set(e, 'help', `the url "${location}" did not provide valid JSON data`));
                }

                var error,
                    urlObj,
                    resource = 'resource';

                if (response.statusCode !== 200) {
                    urlObj = url.parse(location);

                    (urlObj.hostname === POSTMAN_API_HOST) &&
                        (resource = _(urlObj.path).split('/').get(1).slice(0, -1) || resource);

                    error = new Error(_.get(body, 'error.message',
                        `Error fetching ${resource}, the provided URL returned status code: ${response.statusCode}`));

                    return callback(_.assign(error, {
                        name: _.get(body, 'error.name', _.capitalize(resource) + 'FetchError'),
                        help: `Error fetching the ${resource} from the provided URL. Ensure that the URL is valid.`
                    }));
                }

                return callback(null, body);
            });
        });
    }
};
