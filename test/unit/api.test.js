let nock = require('nock'),
    sinon = require('sinon'),
    request = require('postman-request'),
    liquidJSON = require('liquid-json'),
    PostmanResourceAPI = require('../../lib/api'),
    COLLECTION = {
        id: 'C1',
        name: 'Collection',
        item: [{
            id: 'ID1',
            name: 'R1',
            request: 'https://postman-echo.com/get'
        }]
    },
    ENVIRONMENT = {
        id: 'E1',
        name: 'Environment',
        values: [{
            key: 'foo',
            value: 'bar'
        }]
    },

    POSTMAN_API_URL = 'https://api.getpostman.com',
    COLLECTION_URL_WITH_API = `${POSTMAN_API_URL}/collections/1234?apikey=1234`,
    SAMPLE_POSTMAN_UID = '1234-931c1484-fd1e-4ceb-81d0-2aa102ca8b5f',
    SAMPLE_POSTMAN_ID = '931c1484-fd1e-4ceb-81d0-2aa102ca8b5f',

    REMOTE_RESOURCE_NOT_FOUND = 'could not find the remote resource location',
    NO_AUTHORIZATION_DATA = 'No authorization data found';

describe('PostmanResourceAPI class', function () {
    let request_sandbox = sinon.createSandbox(),
        responseCode, response;

    before(function () {
        nock(POSTMAN_API_URL)
            .persist()
            .get(/^\/collections\/.*/)
            .reply(200, { collection: COLLECTION });

        nock(POSTMAN_API_URL)
            .persist()
            .get(/^\/environments\/.*/)
            .reply(() => {
                return [responseCode, response];
            });

        nock(POSTMAN_API_URL)
            .persist()
            .put(/^\/collections\/.*/)
            .reply(200, { collection: COLLECTION });

        nock(POSTMAN_API_URL)
            .persist()
            .put(/^\/environments\/.*/)
            .reply(() => {
                return [responseCode, response];
            });

        nock(POSTMAN_API_URL)
            .persist()
            .get(/^\/collections$/)
            .query(true)
            .reply(200, { collections: [COLLECTION, COLLECTION] });
    });

    after(function () {
        nock.restore();
    });

    afterEach(function () {
        request_sandbox.restore();
    });

    describe('get', function () {
        beforeEach(function () {
            // spy the `get` function
            request_sandbox.spy(request, 'get');
        });

        it('should fetch a resource from its URL', function (done) {
            let collectionAPI = new PostmanResourceAPI('collection',
                { postmanApiKey: '1234' }, COLLECTION_URL_WITH_API);

            collectionAPI.get(COLLECTION_URL_WITH_API, (err, collection) => {
                expect(err).to.be.null;
                expect(collection).to.eql(COLLECTION);

                request_sandbox.assert.calledOnce(request.get);

                let requestArg = request.get.firstCall.args[0];

                expect(requestArg).to.be.an('object').and.include.keys(['url', 'json']);
                expect(requestArg.url).to.equal(COLLECTION_URL_WITH_API);
                expect(requestArg.json).to.equal(true);
                done();
            });
        });

        it('should fetch a resource from its ID using postman-api-key', function (done) {
            let environmentAPI = new PostmanResourceAPI('environment',
                { postmanApiKey: '1234' }, SAMPLE_POSTMAN_ID);

            responseCode = 200;
            response = { environment: ENVIRONMENT };

            environmentAPI.get((err, environment) => {
                expect(err).to.be.null;
                expect(environment).to.eql(ENVIRONMENT);

                request_sandbox.assert.calledOnce(request.get);

                let requestArg = request.get.firstCall.args[0];

                expect(requestArg).to.be.an('object').and.include.keys(['url', 'json']);
                expect(requestArg.url).to.equal(`${POSTMAN_API_URL}/environments/${SAMPLE_POSTMAN_ID}?apikey=1234`);
                expect(requestArg.json).to.equal(true);
                done();
            });
        });

        it('should pass an error if the URL doesn\'t represent a Postman resource', function (done) {
            let collectionAPI = new PostmanResourceAPI('collection',
                { postmanApiKey: '1234' });

            collectionAPI.get('https://example.com/collection.json', (err) => {
                expect(err).not.be.null;
                expect(err).to.be.equal(REMOTE_RESOURCE_NOT_FOUND);
                done();
            });
        });

        it('should pass an error if the authorization details are not available', function (done) {
            let environmentAPI = new PostmanResourceAPI('environment', {}, SAMPLE_POSTMAN_ID);

            environmentAPI.get(SAMPLE_POSTMAN_ID, (err) => {
                expect(err).not.be.null;
                expect(err).to.be.equal(NO_AUTHORIZATION_DATA);
                done();
            });
        });
    });

    describe('update', function () {
        beforeEach(function () {
            // spy the `put` function
            request_sandbox.spy(request, 'put');
        });

        it('should update a resource from its URL', function (done) {
            let environmentAPI = new PostmanResourceAPI('environment'),
                location = `https://api.getpostman.com/environments/${SAMPLE_POSTMAN_UID}?apikey=123456`;

            responseCode = 200;

            environmentAPI.update(ENVIRONMENT, location, (err) => {
                expect(err).to.be.null;

                request_sandbox.assert.calledOnce(request.put);

                let requestArg = request.put.firstCall.args[0],
                    body;

                expect(requestArg).to.be.an('object').and.include.keys(['url', 'headers', 'body']);
                expect(requestArg.url).to.equal(location);
                expect(requestArg.headers).to.be.an('object')
                    .that.has.property('Content-Type', 'application/json');

                body = liquidJSON.parse(requestArg.body.trim());
                expect(body).to.eql({ environment: ENVIRONMENT });

                done();
            });
        });

        it('should update a resource from its UID using postman-api-key', function (done) {
            let collectionAPI = new PostmanResourceAPI('collection',
                { postmanApiKey: '1234' }, COLLECTION_URL_WITH_API);

            collectionAPI.update(COLLECTION, SAMPLE_POSTMAN_UID, (err) => {
                expect(err).to.be.null;

                request_sandbox.assert.calledOnce(request.put);

                let requestArg = request.put.firstCall.args[0],
                    body;

                expect(requestArg).to.be.an('object').and.include.keys(['url', 'headers', 'body']);
                expect(requestArg.url).to
                    .equal(`https://api.getpostman.com/collections/${SAMPLE_POSTMAN_UID}?apikey=1234`);
                expect(requestArg.headers).to.be.an('object')
                    .that.has.property('Content-Type', 'application/json');

                body = liquidJSON.parse(requestArg.body.trim());
                expect(body).to.eql({ collection: COLLECTION });

                done();
            });
        });

        it('should pass the error from response body if the response code is not of the form 2xx', function (done) {
            let environmentAPI = new PostmanResourceAPI('environment'),
                location = `https://api.getpostman.com/environments/${SAMPLE_POSTMAN_UID}?apikey=123456`;

            responseCode = 401;
            response = {
                error: {
                    message: 'Invalid API Key. Every request requires a valid API Key to be sent.'
                }
            };

            environmentAPI.update(ENVIRONMENT, location, (err) => {
                expect(err).not.to.be.null;
                expect(err.message).to.contain(response.error.message);
                expect(err.help, 'help should contain the type of operation done').to.contain('sync');

                request_sandbox.assert.calledOnce(request.put);

                let requestArg = request.put.firstCall.args[0],
                    body;

                expect(requestArg).to.be.an('object').and.include.keys(['url', 'headers', 'body']);
                expect(requestArg.url).to.equal(location);
                expect(requestArg.headers).to.be.an('object')
                    .that.has.property('Content-Type', 'application/json');

                body = liquidJSON.parse(requestArg.body.trim());
                expect(body).to.eql({ environment: ENVIRONMENT });

                done();
            });
        });

        it('should pass an error if the authorization details are not available', function (done) {
            let environmentAPI = new PostmanResourceAPI('environment'),
                location = `https://api.getpostman.com/environments/${SAMPLE_POSTMAN_UID}`;

            environmentAPI.update(ENVIRONMENT, location, (err) => {
                expect(err).not.to.be.null;
                expect(err).to.be.equal(NO_AUTHORIZATION_DATA);
                done();
            });
        });
    });

    describe('getAll', function () {
        beforeEach(function () {
            // spy the `get` function
            request_sandbox.spy(request, 'get');
        });

        it('should get all the resources of its type', function (done) {
            let collectionAPI = new PostmanResourceAPI('collection', { postmanApiKey: '1234' });

            collectionAPI.getAll((err, collections) => {
                expect(err).to.be.null;
                expect(collections).to.eql([COLLECTION, COLLECTION]);

                request_sandbox.assert.calledOnce(request.get);

                let requestArg = request.get.firstCall.args[0];

                expect(requestArg).to.be.an('object').and.include.keys(['url', 'json']);
                expect(requestArg.url).to.equal(`${POSTMAN_API_URL}/collections?apikey=1234`);
                expect(requestArg.json).to.equal(true);

                done();
            });
        });

        it('should pass an error if `request.get` returns one', function (done) {
            let environmentAPI = new PostmanResourceAPI('environment', { postmanApiKey: '1234' });

            request.get.restore();
            request_sandbox.stub(request, 'get').callsFake((_requestOptions, callback) => {
                return callback(new Error('Uncaught ReferenceError'));
            });

            environmentAPI.getAll((err) => {
                expect(err).not.to.be.null;
                expect(err.message, 'should pass error passed by request.get').to.be.equal('Uncaught ReferenceError');
                expect(err.help, 'should indicate the operation in err.help').to.contain('fetch');
                done();
            });
        });
    });
});
