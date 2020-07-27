/* istanbul ignore file */
let _ = require('lodash'),
    waterfall = require('async/waterfall'),

    util = require('../util'),

    /**
     * The message displayed when Postman API-key is not available from any sources
     *
     * @type {String}
     */
    NO_AUTHORIZATION_DATA = 'No authorization data found',

    /**
     * The message displayed when the corresponding remote resource of a resource could
     * not be found
     *
     * @type {String}
     */
    REMOTE_RESOURCE_NOT_FOUND = 'could not find the remote resource location',

    /**
     * Map of resource type and its equivalent API pathname.
     *
     * @type {Object}
     */
    POSTMAN_API_PATH_MAP = {
        collection: 'collections',
        environment: 'environments'
    },

    POSTMAN_API_HOST = 'api.getpostman.com',

    POSTMAN_API_URL = 'https://' + POSTMAN_API_HOST,

    DEFAULT_HEADERS = {
        'User-Agent': util.userAgent
    },

    /**
     * Gets the session API Key from the members of the loaded class instance.
     *
     * @param {Function} callback - The function to be invoked after the process
     * @returns {*}
     */
    getSessionAPIKey = function (callback) {
        let { postmanApiKey } = this.sessionDetails;

        if (postmanApiKey) {
            return callback(null, postmanApiKey);
        }

        // @todo - Load API Key from rc-file data
        return callback(NO_AUTHORIZATION_DATA);
    },

    /**
     * Processes the location corresponding to the remote resource to get the URL. The returned URL will
     * also contain API-Key required for authentication as a query-param
     *
     * @param {String} location - The location indicating the remote resource. Can be a URL, Postman-ID or Postman-UID
     * @param {Function} callback - The function to be invoked after the process
     * @returns {*}
     */
    getURL = function (location, callback) {
        if (util.POSTMAN_ID_REGEX.test(location)) {
            location = `${POSTMAN_API_URL}/${POSTMAN_API_PATH_MAP[this.type]}/${location}`;
        }

        if (!util.POSTMAN_API_URL_REGEX.test(location)) {
            return callback(REMOTE_RESOURCE_NOT_FOUND);
        }

        if ((/.\?apikey=./).test(location)) {
            return callback(null, location);
        }

        return getSessionAPIKey.call(this, (err, apiKey) => {
            if (err) { return callback(err); }

            location = util.addQueryParams(location, { apikey: apiKey });

            return callback(null, location);
        });
    };

class PostmanResourceAPI {
    /**
     * @param {String} type - The type of the resource, eg:'collection', 'environment' etc
     * @param {Object} [sessionDetails] - The object including authentication-related data to be used in all requests
     * @param {String} [sessionDetails.postmanApiKey] - The postman-api-key specified as a command option
     * or through system-environment
     * @param {String} [defaultLocation] - The default location to be used for all methods
     */
    constructor (type, sessionDetails, defaultLocation) {
        this.type = type;
        this.defaultLocation = defaultLocation;
        this.sessionDetails = sessionDetails || {};
    }

    /**
     * Gets the resource from the specified location
     *
     * @param {String} [location=this.defaultLocation] - Can be a URL, Postman-ID or Postman-UID
     * @param {Function} callback - The function to be invoked after the load
     */
    get (location, callback) {
        if (!callback && _.isFunction(location)) {
            callback = location;
            location = this.defaultLocation;
        }

        waterfall([
            (next) => {
                return getURL.call(this, location, next);
            },

            (url, next) => {
                return util.apiRequest('GET', {
                    url: url,
                    json: true,
                    headers: DEFAULT_HEADERS,
                    // Temporary fix to fetch the collection from https URL on Node v12
                    // @todo find the root cause in postman-request
                    // Refer: https://github.com/postmanlabs/newman/issues/1991
                    agentOptions: {
                        keepAlive: true
                    }
                }, this.type, next);
            }

        ], (err, response) => {
            if (err) { return callback(err); }

            // get the respective field from the body
            return callback(null, _.get(response, this.type));
        });
    }

    /**
     * Updates the remote resource with the data passed in
     *
     * @param {Object} data - The updated value of the resource
     * @param {String} [location=this.defaultLocation] - URL, Postman-ID or Postman-UID indicating the resource
     * @param {Function} callback - The function to be invoked after the updation
     */
    update (data, location, callback) {
        if (!callback && _.isFunction(location)) {
            callback = location;
            location = this.defaultLocation;
        }

        waterfall([
            (next) => {
                return getURL.call(this, location, next);
            },

            (url, next) => {
                let headers = {
                    ...DEFAULT_HEADERS,
                    'Content-Type': 'application/json'
                };

                (data = _.set({}, this.type, data)); // format the data to indicate the field

                return util.apiRequest('PUT', {
                    url: url,
                    headers: headers,
                    body: JSON.stringify(data)
                }, this.type, next);
            }

        ], (err) => {
            return callback(err);
        });
    }

    /**
     * Gets all the resources with type as that of the instance
     *
     * @param {Function} callback - The function to be invoked after the fetch
     */
    getAll (callback) {
        waterfall([
            (next) => {
                return getSessionAPIKey.call(this, next);
            },

            (apiKey, next) => {
                // formulate the URL for the fetch
                let url = `${POSTMAN_API_URL}/${POSTMAN_API_PATH_MAP[this.type]}`;

                // add the apikey as a query-param
                url = util.addQueryParams(url, { apikey: apiKey });

                return util.apiRequest('GET', {
                    url: url,
                    json: true,
                    headers: DEFAULT_HEADERS,
                    // Temporary fix to fetch the collection from https URL on Node v12
                    // @todo find the root cause in postman-request
                    // Refer: https://github.com/postmanlabs/newman/issues/1991
                    agentOptions: {
                        keepAlive: true
                    }
                }, next);
            }

        ], (err, response) => {
            if (err) { return callback(err); }

            // get the respective field from the body
            // since the field required is the same as the path name, the map to the same is used
            return callback(null, _.get(response, POSTMAN_API_PATH_MAP[this.type]));
        });
    }
}

module.exports = PostmanResourceAPI;
