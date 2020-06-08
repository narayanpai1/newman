/* eslint-disable no-process-env */
const fs = require('fs'),
    sh = require('shelljs'),
    join = require('path').join,

    ALIAS_NOT_FOUND = 'Alias not found.',
    SUCCESS_MESSAGE = 'Logout successful.';

describe('Logout command', function () {
    let outDir = join(__dirname, '..', '..', 'out'),
        configDir = join(outDir, '.postman'),
        rcFile = join(configDir, 'newmanrc'),
        isWin = (/^win/).test(process.platform),
        homeDir = process.env[isWin ? 'userprofile' : 'HOME'],
        testData = {
            login: {
                _profiles: [
                    {
                        alias: 'default'
                    }
                ]
            }
        };

    before(function () {
        // change the home directory to alter the location of the rc file
        process.env[isWin ? 'userprofile' : 'HOME'] = outDir;
    });

    after(function () {
        // update the home directory back to its original value
        process.env[isWin ? 'userprofile' : 'HOME'] = homeDir;
    });

    beforeEach(function () {
        fs.existsSync(outDir) && sh.rm('-rf', outDir);
        fs.mkdirSync(outDir);
    });

    afterEach(function () {
        sh.rm('-rf', outDir);
    });

    it('should work if the alias exists', function (done) {
        fs.mkdirSync(configDir);
        fs.writeFileSync(rcFile, JSON.stringify(testData, null, 2), { mode: 0o600 });

        exec('node ./bin/newman.js logout', function (code, stdout, stderr) {
            expect(code, 'should have exit code of 0').to.equal(0);
            expect(stdout, 'should display success message').to.contain(SUCCESS_MESSAGE);
            expect(stderr).to.be.empty;
            done();
        });
    });

    it('should print an error if the alias doesn\'t exist', function (done) {
        fs.mkdirSync(configDir);
        fs.writeFileSync(rcFile, JSON.stringify(testData, null, 2), { mode: 0o600 });

        exec('node ./bin/newman.js logout testalias', function (code, _stdout, stderr) {
            expect(code, 'should have exit code of 1').to.equal(1);
            expect(stderr, 'should display the error message').to.contain(ALIAS_NOT_FOUND);
            done();
        });
    });
});
