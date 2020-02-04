/**
 * NEAR chunks mapped to ETH objects and vice versa
 */
const assert = require('bsert');
const utils = require('./utils');

const nearToEth = {};

/**
 * Formats NEAR chunks to ETH transaction objects
 * @param {Array} block block
 * @param {Boolean} returnTxObjects (optional) default false. if true,
 * return entire transaction object, otherwise just hashes
 * @returns {Array} returns array of tx hashes or full tx object
 */
nearToEth._formatChunksToTx = function(block, returnTxObjects) {
	const hasTxs = block.chunks.length > 0;
	let transactions = [];

	if (hasTxs && !returnTxObjects) {
		// Return tx hashes (default)
		transactions = block.chunks.map((c) => utils.base58ToHex(c.chunk_hash));
	} else if (hasTxs && returnTxObjects) {
		// Return transaction object if requested and txs exist
		const blockHeaderHash = block.header.hash;
		transactions = block.chunks.map((c) => this.transactionObj(c, blockHeaderHash));
	}

	return transactions;
}

/**
 * Maps NEAR chunk to ETH Transaction Object
 * @param {Object} chunk NEAR transaction chunk
 * @param {Hex} blockHeaderHash
 * @returns {object} returns ETH transaction object
 * @example eth.transactionObject(chunk, blockHeaderHash)
 */
// TODO: Verify what blockHash should be
nearToEth.transactionObj = function(chunk, blockHeaderHash) {
	assert(typeof chunk === 'object' && chunk.hasOwnProperty('chunk_hash'), 'nearToEth.transactionObj: must pass in chunk object');

	return {
		hash: utils.base58ToHex(chunk.chunk_hash),
		blockHash: utils.base58ToHex(blockHeaderHash),
		blockNumber: utils.decToHex(chunk.height_included),

		// TODO: Don't know how to get these values
		nonce: '0x1',
		transactionIndex: '0x1',
		from: '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368',
		to: '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368',
		gas: '0xffffffff',
		gasPrice: '0x4a817c800',
		input: '0x',
		value: '0x',
		v: '0x25',
		r: '0x1b5e176d927f8e9ab405058b2d2457392da3e20f328b16ddabcebc33eaac5fea',
		s: '0x4ba69724e8f69de52f0125ad8b3c5c2cef33019bac3249e2c0a2192766d1721c'
	};
}

/**
 * Maps NEAR Block to ETH Block Object
 * @param {Object} block NEAR block
 * @param {Boolean} returnTxObjects (optional) default false. if true, return
 * entire transaction object, other just hashes
 * @returns {Object} returns ETH block object
 */
nearToEth.blockObj = function(block, returnTxObjects) {
	const { header } = block;

	return {
		number: utils.decToHex(header.height),
		hash: utils.base58ToHex(header.hash),
		parentHash: utils.base58ToHex(header.prev_hash),
		nonce: null,
		// sha3Uncles: '',
		// logsBloom: '',
		transactionsRoot: utils.base58ToHex(header.chunk_tx_root),
		// stateRoot: '',
		// miner: '',
		// difficulty: null,
		// totalDifficulty: null,
		// extraData: '',
		// size: null,
		// TODO: gas limit
		gasLimit: "0xffffffffff",
		gasUsed: null,
		timestamp: utils.convertTimestamp(header.timestamp),
		transactions: this._formatChunksToTx(block, returnTxObjects),
		uncles: ['']
	};
};

/**
 * ETH Sync Object
 */
nearToEth.syncObj = function() {
	return {
		// TODO: Not sure how to get this
		startingBlock: '0x0',
		currentBlock: utils.decToHex(sync_info.latest_block_height),
		// TODO: Not sure how to get this
		highestBlock: '0x0',
		// TODO: The following are not listed in the RPC docs but are expected in web3
		knownStates: '0x0',
		pulledStates: '0x0'
	};
}

module.exports = nearToEth;
