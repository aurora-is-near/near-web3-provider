const assert = require('bsert');
const bs58 = require('bs58');

const utils = {};

/**
 * Remove 0x if prepended
 * @param {string} value value to check and modify
 * @return {string} string without 0x
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
 * Checks if string is hex
 * @param {string} value value to check
 * @returns {boolean} true if value is hex, false if not
 */
utils.isHex = function(value) {
    assert(typeof value === 'string', 'isHex: must pass in string');
    const hexTest = /^(0[xX])?[A-Fa-f0-9]+$/;
    return hexTest.test(value);
};

/**
 * Converts number to hex
 * @param {Number|Object} value number to convert to hex.
 * @returns {string} hex string equivalent of number
 */
utils.decToHex = function(value) {
    assert(
        typeof value === 'number' || typeof value === 'object',
        'decToHex: must pass in number'
    );

    return '0x' + value.toString(16);
};

/**
 * Converts hex to number
 * @param {string} value hex string to convert to number
 * @returns {number} number equivalent of hex string
 */
utils.hexToDec = function(value) {
    assert(typeof value === 'string', 'hexToDec: must pass in hex string');
    assert(this.isHex(value), 'hexToDec: must pass in hex string');

    return parseInt(value.slice(2), 16);
};

/**
 * Converts base58 object to hex string
 * @param {string|array|buffer|arrayBuffer} value base58 object
 * @returns {string} hex string equivalent of base58 object
 */
utils.base58ToHex = function(value) {
    return '0x' + Buffer.from(bs58.decode(value)).toString('hex');
};

/**
 * Converts hex string to base58 string
 * @param {string} value hex string
 * @returns {string} returns base58 string equivalent of hex string
 */
utils.hexToBase58 = function(value) {
    console.log({value});
    assert(typeof value === 'string', 'hexToBase58: must pass in hex string');
    assert(this.isHex(value), 'hexToBase58: must pass in hex string');
    value = this.remove0x(value);

    return bs58.encode(Buffer.from(value, 'hex'));
};

/**
 * Converts base64 object to hex string
 * @param {string|array|buffer|arrayBuffer} value base64 object
 * @returns {string} hex string equivalent of base64 object
 */
utils.base64ToHex = function(value) {
    return '0x' + Buffer.from(value, 'base64').toString('hex');
};

/**
 * Converts base64 object to string
 * @param {string|array|buffer|arrayBuffer} value base64 object
 * @returns {string} string equivalent of base64 object
 */
utils.base64ToString = function(value) {
    return Buffer.from(value, 'base64').toString();
};

/**
 * Convert timestamp in NEAR to hex
 * @param {number} value NEAR timestamp
 * @returns {string} hex string equivalent of timestamp
 */
utils.convertTimestamp = function(value) {
    assert(typeof value === 'number', 'convertTimestamp: must pass in number');
    // NB: NEAR timestamps need to be divided by 1000000 to be converted to a value that produces a valid new Date(). However, this value is now a decimal, which cannot be converted to a valid hex String. Passing this value into new Date() and then calling getTime() will yield a rounded epoch time that can then be converted to valid hex.
    // Example with NEAR block number 1221180 with timestamp 1580771932817928262.
    // Dividing this by 1000000 yields 1580771932817.9282 which translates to a date of 'Mon Feb 03 2020 16:18:52 GMT-0700'.Calling getTime() gives 1580771932000 which can then be converted to hex 0x1700d597760.
    // If we convert the original timestamp 1580771932817928262 to hex, it yields 0x15f007b296853000. Attempting to pass this through to web3 results in the error: 'Number can only safely store up to 53 bits'
    const divider = 1000000;
    const roundedTime = new Date(value / divider).getTime();
    return this.decToHex(roundedTime);
};

/**
 * Splits hex string into txHash and accountId
 * Used by eth_getTransactionByHash, eth_getTransactionReceipt
 * @param {String} value hex string in format <txHash>:<accountId>
 * @returns {Object} Returns txHash and accountId
 */
utils.getTxHashAndAccountId = function(value) {
  assert(
    value.includes(':'),
    'Must pass in hash and accountId separated by ":" <txHash:accountId>'
  );
  // Split value into txHash and accountId
  const [ txHash, accountId ] = value.split(':');

  // Return object for convenience so we don't need to keep track of index order
  return { txHash, accountId };
}
module.exports = utils;
