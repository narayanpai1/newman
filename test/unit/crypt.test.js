const crypt = require('../../lib/crypt'),

    TEXT = 'test123',
    ENCODED_TEXT = ':\u0019.7!Dd3',
    ENCRYPTED_TEXT = '46cd0f91ffb1fefc8b9b1edfd4853dbc',
    KEY = 'p@s$key',

    TEXT_WITH_ILLEGALS = '123456&',
    ENCODED_TEXT_WITH_ILLEGALS = '\u0018LF3!TlҀ';

describe('Crypt library', function () {
    describe('AES Encryption', function () {
        it('encrypt', function () {
            let encrypted = crypt.encrypt(TEXT, KEY);

            expect(encrypted).to.be.equal(ENCRYPTED_TEXT);
        });

        it('decrypt', function () {
            let decrypted = crypt.decrypt(ENCRYPTED_TEXT, KEY);

            expect(decrypted).to.be.equal(TEXT);
        });
    });

    describe('Base 122 Encoding', function () {
        it('encode text containing legal code points', function () {
            let encoded = crypt.encode(TEXT);

            expect(encoded).to.be.equal(ENCODED_TEXT);
        });

        it('decode text containing legal code points', function () {
            let decoded = crypt.decode(ENCODED_TEXT);

            expect(decoded).to.be.equal(TEXT);
        });

        it('encode text containing illegal code points', function () {
            let encoded = crypt.encode(TEXT_WITH_ILLEGALS);

            expect(encoded).to.be.equal(ENCODED_TEXT_WITH_ILLEGALS);
        });

        it('decode text containing illegal code points', function () {
            let decoded = crypt.decode(ENCODED_TEXT_WITH_ILLEGALS);

            expect(decoded).to.be.equal(TEXT_WITH_ILLEGALS);
        });
    });
});
