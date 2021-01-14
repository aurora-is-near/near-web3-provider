const os = require('os');
const path = require('path');
const assert = require('bsert');
const bs58 = require('bs58');
const rlp = require('rlp');
const web3Utils = require('web3-utils');
const BN = require('bn.js');
const fs = require('fs');
const nearAPI = require('near-api-js');
const { getNetworkConfig } = require('./network-config');

const utils = {};

const CREDENTIALS_DIR = '~/.near-credentials';

utils.keccak256 = web3Utils.keccak256;

/**
 * base58 for 0s. Indicates empty result
 */
utils.emptyResult = '11111111111111111111111111111111';

/**
 * Remove 0x if prepended
 * @param {String} value value to check and modify
 * @return {String} string without 0x
 */
utils.remove0x = function(value) {
    assert(typeof value === 'string', 'remove0x: must pass in string');

    if (value.slice(0, 2) === '0x') {
        return value.slice(2);
    } else {
        return value;
    }
};

/**
 * Add 0x if not prepended
 * @param {String} value value to check and modify
 * @return {String} string with 0x
 */
utils.include0x = function(value) {
    assert(typeof value === 'string', 'include0x: must pass in string');

    if (value.slice(0, 2) === '0x') {
        return value;
    } else {
        return `0x${value}`;
    }
};

/**
 * Checks if string is hex
 * @param {String} value value to check
 * @returns {Boolean} true if value is hex, false if not
 */
utils.isHex = function(value) {
    assert(typeof value === 'string', 'isHex: must pass in string');
    const hexTest = /^(0[xX])?[A-Fa-f0-9]+$/;
    return hexTest.test(value);
};

/**
 * Checks if string is valid accountID
 * citing: https://github.com/nearprotocol/nearcore/blob/bf5f272638dab6d8ff7ebc6d8272c08db3aff06c/core/primitives/src/utils.rs#L75
 * @param {String} value value to check
 * @returns {Boolean} true if value is valid accountID, false if not
 */
utils.isValidAccountID = function(value) {
    assert(typeof value === 'string', 'isValidAccountID: must pass in string');
    assert(value == value.toLowerCase(), `isValidAccountID: near accountID cannot have uppercase letters: ${value}`);

    const accountIDTest = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
    return (
        value.length >= 2 &&
        value.length <= 64 &&
        accountIDTest.test(value)
    );
};

/**
 * Converts number to hex
 * @param {Number|Object} value number to convert to hex.
 * @returns {String} hex string equivalent of number
 */
utils.decToHex = function(value) {
    assert(
        typeof value === 'number' || typeof value === 'object',
        'decToHex: must pass in number'
    );

    return '0x' + value.toString(16);
};

/**
 *
 * Deserializes a hex string into a Uint8Array
 *
 * @param {String}    hexStr The value as a hex string
 * @returns {Uint8Array}      The value as a u8a
 */
utils.deserializeHex = function(hexStr, fixedLen) {
    if (!hexStr) {
        if (fixedLen) {
            return new Uint8Array(fixedLen);
        }
        return new Uint8Array();
    }

    if (typeof hexStr !== 'string') {
        throw new TypeError('Error deserializing hex, must be a string');
    }

    let hex = '';
    if (hexStr.slice(0, 2) === '0x') {
        hex = hexStr.slice(2);
    } else {
        hex = hexStr;
    }

    // Append 0 in front if it's odd number of characters.
    if (hex.length % 2 !== 0) {
        hex = `0${hex}`;
    }

    assert(!fixedLen || (hex.length / 2 <= fixedLen));

    const a = [];

    // Pad with 0s for fixed length arrays.
    if (fixedLen) {
        for (let i = hex.length / 2; i < fixedLen; i += 1) {
            a.push(0);
        }
    }

    for (let i = 0; i < hex.length; i += 2) {
        const byte = hex.substr(i, 2);
        const uint8 = parseInt(byte, 16);

        // TODO: any way to improve this?
        if (!uint8 && uint8 !== 0) {
            throw new TypeError(`Error deserializing hex, got non-hex byte: ${byte}`);
        }

        a.push(uint8);
    }

    return new Uint8Array(a);
};

/**
 * Converts hex to number
 * @param {String} value hex string to convert to number
 * @returns {Number} number equivalent of hex string
 */
utils.hexToDec = function(value) {
    assert(typeof value === 'string', 'hexToDec: must pass in hex string');
    assert(utils.isHex(value), 'hexToDec: must pass in hex string');

    return parseInt(utils.remove0x(value), 16);
};

/**
 * Converts hex to string.
 * @param {String} value hex string to convert to number.
 * @returns {String} decoded string.
 */
utils.hexToString = function(value) {
    assert(typeof value === 'string', 'hexToDec: must pass in hex string');
    assert(utils.isHex(value), 'hexToDec: must pass in hex string');

    return Buffer.from(utils.remove0x(value), 'hex').toString();
};

/**
 * Converts base58 object to hex string
 * @param {String|Array|Buffer|ArrayBuffer} value base58 object
 * @returns {String} hex string equivalent of base58 object
 */
utils.base58ToHex = function(value) {
    return '0x' + Buffer.from(bs58.decode(value)).toString('hex');
};

/**
 * Converts hex string to base58 string
 * @param {String} value hex string
 * @returns {String} returns base58 string equivalent of hex string
 */
utils.hexToBase58 = function(value) {
    assert(typeof value === 'string', 'hexToBase58: must pass in hex string');
    assert(utils.isHex(value), 'hexToBase58: must pass in hex string');
    value = utils.remove0x(value);

    return bs58.encode(Buffer.from(value, 'hex'));
};

/**
 * Converts base64 object to string
 * @param {String|Array|Buffer|ArrayBuffer} value base64 object
 * @returns {Buffer} bytes equivalent of base64 object
 */
utils.base64ToBuffer = function (value) {
    return Buffer.from(value, 'base64');
};

/**
 * Converts base64 object to hex string
 * @param {String|Array|Buffer|ArrayBuffer} value base64 object
 * @returns {String} hex string equivalent of base64 object
 */
utils.base64ToHex = function(value) {
    return '0x' + Buffer.from(value, 'base64').toString('hex');
};

/**
 * Converts base64 object to string
 * @param {String|Array|Buffer|ArrayBuffer} value base64 object
 * @returns {String} string equivalent of base64 object
 */
utils.base64ToString = function(value) {
    return Buffer.from(value, 'base64').toString();
};

/**
 * Converts hex representation of a base58 string to Uint8Array
 * @param {String}  value hex string
 * @returns {Uint8Array} returns hex string in Uint8Array
 */
utils.hexToUint8 = function(value) {
    return new Uint8Array(bs58.decode(utils.hexToBase58(value)));
};

utils.base58ToUint8 = function(value) {
    return new Uint8Array(bs58.decode(value));
};

/**
 * Converts hex representation of a number to BigNumber format
 * @param {String}  value hex string
 * @returns {Uint8Array} returns hex string in Uint8Array
 */
utils.hexToBN = function(hex) {
    const remove = utils.remove0x(hex.toString());
    return new BN(remove, 16);
};

/**
 * Converts raw message from EVM into character codes
 * @param {String}  value string from EVM typically of the form '[8, 19, 0, 68…]'
 * @returns {String} returns string
 * Note: some characters may not be utf8 compatible
 */
utils.evmMessageToCharString = function(msg) {
    return JSON.parse(msg).map(i => String.fromCharCode(i)).join('');
};

/**
 * Convert timestamp in NEAR to hex
 * @param {Number} value NEAR timestamp
 * @returns {String} hex string equivalent of timestamp
 */
utils.convertTimestamp = function(value) {
    value = parseInt(value);
    assert(typeof value === 'number', 'convertTimestamp: must pass in number');
    // NB: NEAR timestamps need to be divided by 1000000 to be converted to a value that produces a valid new Date(). However, this value is now a decimal, which cannot be converted to a valid hex String. Passing this value into new Date() and then calling getTime() will yield a rounded epoch time that can then be converted to valid hex.
    // Example with NEAR block number 1221180 with timestamp 1580771932817928262.
    // Dividing this by 1000000 yields 1580771932817.9282 which translates to a date of 'Mon Feb 03 2020 16:18:52 GMT-0700'.Calling getTime() gives 1580771932000 which can then be converted to hex 0x1700d597760.
    // If we convert the original timestamp 1580771932817928262 to hex, it yields 0x15f007b296853000. Attempting to pass this through to web3 results in the error: 'Number can only safely store up to 53 bits'
    const divider = 1000000;
    const roundedTime = new Date(value / divider).getTime();
    return utils.decToHex(roundedTime);
};

/**
 * Splits hex string into txHash and accountId if both are passed through
 * Used by eth_getTransactionByHash, eth_getTransactionReceipt
 * @param {String} value hex string in format <txHash>:<accountId> or txHash
 * @returns {Object} Returns txHash and accountId as strings
 */
utils.getTxHashAndAccountId = function(value) {
    if (value.includes(':')) {
        // Split value into txHash and accountId
        const [txHash, accountId] = value.split(':');

        // Return object for convenience so we don't need to keep track of index order
        return { txHash, accountId };
    } else {
        return { txHash: value, accountId: '' };
    }
};

/**
 * Converts a Near account ID into the corresponding ETH address
 * @param {String} accountID account ID as a string
 * @returns {String} Returns the corresponding ETH address with a 0x prefix
 */
utils.nearAccountToEvmAddress = function(accountID) {
    assert(
        utils.isValidAccountID(accountID), 'nearAccountToEvmAddress must pass in valid accountID'
    );
    // NB: 2 characters of hex prefix. Then 20 hex pairs.
    return '0x' + utils.keccak256(accountID).slice(26, 66);
};

/**
 * Converts an enum blockHeight OR a hex blockHeight to number
 * @param {Quantity|Tag} blockHeight block height or enum string
 * 'genesis', 'latest', 'earliest', or 'pending'
 * @returns {Number} blockHeight in number form
 */
utils.convertBlockHeight = async function(blockHeight, nearProvider) {
    try {
        const enums = ['genesis', 'latest', 'earliest', 'pending'];
        const notHex = !utils.isHex(blockHeight);
        const isAnEnum = enums.find((e) => e === blockHeight);

        if (notHex && typeof blockHeight === 'string') {
            assert(isAnEnum,
                'Must pass in a valid block description: "genesis", "latest", "earliest", "pending"');
        }

        switch (blockHeight) {
        case 'latest' || 'pending': {
            const { sync_info } = await nearProvider.status();
            blockHeight = sync_info.latest_block_height;
            break;
        }

        case 'earliest' || 'genesis': {
            blockHeight = 0;
            break;
        }

        default: {
            blockHeight = utils.hexToDec(blockHeight);
            break;
        }
        }

        return blockHeight;
    } catch (e) {
        return e;
    }
};

// A singleton of current createTestAccount promise.
let __CREATE_ACCOUNT_PROMISE;

// A singleton for account validation to not revalidate every time.
let __CREATE_ACCOUNT_VALIDATION_CACHE = false;

async function _createTestAccount(masterAccount, numAccounts) {
    let currentAccounts = await masterAccount.connection.signer.keyStore.getAccounts(masterAccount.connection.networkId);
    // Remove the master account if it exists, otherwise it'll create one less than numAccounts
    const masterAccountIndex = currentAccounts.indexOf(masterAccount.accountId);
    if (masterAccountIndex !== -1) currentAccounts.splice(masterAccountIndex, 1);
    const numCurrentAccounts = currentAccounts.length;
    if (!__CREATE_ACCOUNT_VALIDATION_CACHE) {
        // Double check that all available accounts are valid accounts for this network.
        for (let i = 0; i < numCurrentAccounts; ++i) {
            try {
                let account = new nearAPI.Account(masterAccount.connection, currentAccounts[i]);
                await account.fetchState();
            } catch (_error) {
                throw Error(`Found account ${currentAccounts[i]} is not available on the network ${masterAccount.connection.networkId}`);
            }
        }
    }
    if (numCurrentAccounts >= numAccounts) {
        __CREATE_ACCOUNT_VALIDATION_CACHE = true;
        return;
    }
    let newAccountIds = [];
    for (let i = 0; i < numAccounts - numCurrentAccounts; ++i) {
        const accountId = `${Date.now()}.${masterAccount.accountId}`;
        const keyPair = nearAPI.utils.KeyPair.fromRandom('ed25519');
        await masterAccount.connection.signer.keyStore.setKey(masterAccount.connection.networkId, accountId, keyPair);
        await masterAccount.createAccount(
            accountId, keyPair.publicKey.toString(),
            nearAPI.utils.format.parseNearAmount('3'));
        newAccountIds.push(accountId);
    }
    console.log(`Created ${numAccounts - numCurrentAccounts} test accounts.`); // TODO: silence this by default
    __CREATE_ACCOUNT_VALIDATION_CACHE = true;
    return newAccountIds;
}

/**
 * Creates given number of test accounts given masterAccounts.
 * Makes sure that if enough accounts are in the key store, they are all available.
 * This can only run once at a time, hence some magic async code.
 */
utils.createTestAccounts = async function(masterAccount, numAccounts) {
    if (__CREATE_ACCOUNT_VALIDATION_CACHE) return 0;
    while (__CREATE_ACCOUNT_PROMISE) await __CREATE_ACCOUNT_PROMISE;
    __CREATE_ACCOUNT_PROMISE = _createTestAccount(masterAccount, numAccounts);
    try {
        let result = await __CREATE_ACCOUNT_PROMISE;
        return result;
    } finally {
        __CREATE_ACCOUNT_PROMISE = null;
    }
};

utils.resolveHomeDir = function(filePath) {
    if (filePath[0] === '~') {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
};

utils.readKeyFile = function(path) {
    const accountInfo = JSON.parse(fs.readFileSync(path));
    let privateKey = accountInfo.private_key;
    if (!privateKey && accountInfo.secret_key) {
        privateKey = accountInfo.secret_key;
    }
    return [accountInfo.account_id, nearAPI.utils.KeyPair.fromString(privateKey)];
};

utils.createLocalKeyStore = function(networkId, keyPath) {
    const credentialsPath = utils.resolveHomeDir(CREDENTIALS_DIR);
    const keyStores = [
        new nearAPI.keyStores.UnencryptedFileSystemKeyStore(credentialsPath),
        new nearAPI.keyStores.UnencryptedFileSystemKeyStore('./neardev'),
    ];
    if (keyPath) {
        const [accountId, keyPair] = utils.readKeyFile(utils.resolveHomeDir(keyPath));
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        keyStore.setKey(networkId, accountId, keyPair).then(() => {});
        keyStores.push(keyStore);
    }
    return new nearAPI.keyStores.MergeKeyStore(keyStores);
};

/** Sends a function call without using JSON to encode arguments. */
utils.rawFunctionCall = async function (account, contractId, methodName, serializedArgs, gas, deposit) {
    const action = new nearAPI.transactions.Action({
        functionCall: new nearAPI.transactions.FunctionCall({
            methodName,
            args: serializedArgs,
            gas,
            deposit
        })
    });
    return account.signAndSendTransaction(contractId, [action]);
};

utils.rawViewCall = async function (account, contractId, methodName, serializedArgs) {
    const result = await account.connection.provider.query(`call/${contractId}/${methodName}`, nearAPI.utils.serialize.base_encode(serializedArgs));
    if (result.logs) {
        account.printLogs(contractId, result.logs);
    }
    return result.result;
};

utils.getInputWithLengthPrefix = function(encodedInput) {
    const encodedInputDeserialized = Buffer.from(utils.deserializeHex(encodedInput));
    const dataView = new DataView(new ArrayBuffer(4));
    dataView.setInt32(0, encodedInputDeserialized.length, true);
    const bufferLength = dataView.buffer;
    const bufferLengthWithInput = Buffer.concat([
        Buffer.from(bufferLength),
        encodedInputDeserialized
    ]);
    return utils.include0x(bufferLengthWithInput.toString('hex'));
};

utils.encodeCallArgs = function(contractId, encodedInput) {
    const finalEncodedInput = utils.getInputWithLengthPrefix(encodedInput);

    return Buffer.concat([Buffer.from(utils.deserializeHex(contractId, 20)),
        Buffer.from(utils.deserializeHex(finalEncodedInput))]);
};

utils.bufferToBn = function(bytes) {
    const hex = bytes.toString('hex');
    return new BN(hex, 16);
};

utils.decodeEthTransaction = function(bytes) {
    let [nonce, gasPrice, gas, to, value, data, v, r, s] = rlp.decode(bytes);
    return {
        nonce: utils.bufferToBn(nonce),
        gasPrice: utils.bufferToBn(gasPrice),
        gas: utils.bufferToBn(gas),
        to: !to || to.length == 0 ? undefined : to.toString('hex'),
        value: utils.bufferToBn(value),
        data: data.toString('hex'),
        v: utils.bufferToBn(v),
        r,
        s
    };
};

utils.encodeViewCallArgs = function(from, contractId, value, encodedInput) {
    const finalEncodedInput = utils.getInputWithLengthPrefix(encodedInput);

    return Buffer.concat([
        Buffer.from(utils.deserializeHex(from, 20)),
        Buffer.from(utils.deserializeHex(contractId, 20)),
        Buffer.from(utils.deserializeHex(value, 32)),
        Buffer.from(utils.deserializeHex(finalEncodedInput))
    ]);
};

utils.decodeCallArgs = function(bytes) {
    return {
        contractId: bytes.slice(0, 20).toString('hex'),
        encodedInput: bytes.slice(20).toString('hex'),
    };
};

utils.encodeTransferArgs = function(address, value) {
    return Buffer.concat([Buffer.from(utils.deserializeHex(address, 20)),
        Buffer.from(utils.deserializeHex(value, 32))]);
};

utils.decodeTransferArgs = function(bytes) {
    return {
        address: bytes.slice(0, 20).toString('hex'),
        amount: bytes.slice(20, 52).toString('hex'),
    };
};

utils.encodeStorageAtArgs = function(address, key) {
    return Buffer.concat([Buffer.from(utils.deserializeHex(address, 20)), Buffer.from(utils.deserializeHex(key, 32))]);
};

class WithdrawArgs {}

const SCHEMA = new Map([
    [WithdrawArgs, {kind: 'struct', fields: [['account_id', 'string'], ['amount', [32]]]}]
]);

utils.encodeWithdrawArgs = function(recipient, amount) {
    const withdrawArgs = new WithdrawArgs();
    withdrawArgs.account_id = recipient;
    withdrawArgs.amount = utils.deserializeHex(amount, 32);
    return nearAPI.utils.serialize.serialize(SCHEMA, withdrawArgs);
};

utils.getNetworkConfig = getNetworkConfig;

module.exports = utils;
