/**
 * NEAR chunks mapped to ETH objects and vice versa
 */
const assert = require('bsert');
const utils = require('./utils');

const nearToEth = {
    utils: {}
};

/**
 * ETH Sync Object
 */
nearToEth.syncObj = function (syncInfo) {
    return {
        startingBlock: '0x0',
        currentBlock: utils.decToHex(syncInfo.latest_block_height),
        highestBlock: utils.decToHex(syncInfo.latest_block_height),
        // TODO: The following are not listed in the RPC docs but are expected in web3
        knownStates: '0x0',
        pulledStates: '0x0'
    };
};

/**
 * Get chunks from a block
 */

/**
 * Hydrate block chunks up to the specified transaction index
 * @param {Object} block NEAR block
 * @param {Number|Tag} txIndex transaction index or 'all'
 */
nearToEth.utils.hydrateBlock = async function(block, txIndex, near) {

};

/**
 * Gets NEAR transactions FROM A BLOCK
 * @param {Array} block block
 * @param {Boolean} returnTxObjects (optional) default false. if true,
 * return entire transaction object, otherwise just hashes
 * @returns {Array} returns array of tx hashes or full tx object
 */
nearToEth._getTxsFromChunks = async function(block, returnTxObjects, near) {
    const hasChunks = block.chunks.length > 0;

    if (!hasChunks) {
        return [];
    }

    // Get all the chunk hashes
    const chunkHashes = block.chunks.map((c) => c.chunk_hash);

    // Create promise function to hydrate each chunk
    const hydrateChunk = async (chunkHash, block) => {
        try {
            const chunk = await this.nearProvider.chunk(chunkHash);

            // Add for convenience and to prevent multiple queries
            chunk.block_hash = block.header.hash;
            chunk.block_height = block.header.height;
            chunk.gas_price = block.header.gas_price;

            return chunk;
        } catch (e) {
            return e;
        }
    };

    // Create promise array of hydrate chunk promises
    const promiseArray = chunkHashes.map((ch) => hydrateChunk(ch, block));

    // Hydrate the chunks
    try {
        const hydratedChunks = await Promise.all(promiseArray);

        let transactions = [];

        // Return either transaction hashes or full transaction objects
        if (hydratedChunks.length > 0 && !returnTxObjects) {
            // Return tx hashes (default)
            transactions = hydratedChunks.map((tx) => utils.base58ToHex(tx.hash));
        } else if (hydratedChunks.length > 0 && returnTxObjects) {
            // Return transaction object if requested and txs exist
            transactions = hydratedChunks.map((tx, txIndex) => {
                return this.transactionObj(tx, txIndex, block, near);
            });
        }

        return transactions;
    } catch (e) {
        return e;
    }
};
/**
 * Maps NEAR Transaction FROM A CHUNK QUERY to ETH Transaction Object
 */

/**
 * Maps NEAR Transaction FROM A TX QUERY to ETH Transaction Object
 * @param {Object} 		tx NEAR transaction
 * @param {Number}		txIndex	txIndex
 * @param {Object}		near nearProvider instance
 * account
 * @returns {Object} returns ETH transaction object
 *
 * @example nearToEth.transactionObject(tx, near
 */
nearToEth.transactionObj = async function(tx, txIndex, near) {
    assert(typeof tx === 'object' && tx.transaction.hash, 'nearToEth.transactionObj: must pass in tx object');

    const { transaction_outcome, transaction } = tx;

  	const sender = utils.nearAccountToEvmAddress(transaction.signer_id);
    const value = transaction.actions.map(v => {
      const k = Object.keys(v)[0];
      return parseInt(v[k].deposit, 10);
    }).reduce((a, b) => a + b);

    return {
        // DATA 32 bytes - hash of the block where this transaction was in
        blockHash: utils.base58ToHex(transaction_outcome.block_hash),

        // QUANTITY block number where this transaction was in
        blockNumber: tx.blockNumber,

        // DATA 20 bytes - address of the sender
        from: sender,

        // QUANTITY gas provided by the sender
        gas: utils.decToHex(transaction_outcome.outcome.gas_burnt),

        // TODO: How to get gas price? it's on the block where the tx came from block.header.gas_price
        gasPrice: '0x4a817c800',

        // DATA 32 bytes - hash of the transaction
        hash: utils.base58ToHex(transaction.hash),

        // DATA - the data sent along with the transaction
        // TODO: Would a comparison be for transaction.actions[i]?
        input: '0x',

        // QUANTITY - the number of txs made by the sender prior to this one
        nonce: utils.decToHex(transaction.nonce),

        // DATA 20 bytes - address of the receiver
        // TODO: to: receiver
        to: '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368',

        // QUANTITY - integer of the tx's index position in the block
        transactionIndex: utils.decToHex(txIndex),

        // QUANTITY - value transferred in wei (yoctoNEAR)
        // TODO: This is not always the only value. other properties have an amount
        value: value,

        // QUANTITY - ECDSA recovery id
        v: '0x0',
        // QUANTITY - ECDSA signature r
        r: '0x0',
        // QUANTITY - ECDSA signature s
        s: '0x0'
    };
};

/**
 * Maps NEAR Block to ETH Block Object
 * @param {Object|String} block NEAR block. If 'empty', return empty block
 * @param {Boolean} returnTxObjects (optional) default false. if true, return
 * entire transaction object, other just hashes
 * @returns {Object} returns ETH block object
 */
nearToEth.blockObj = function(block, returnTxObjects, near) {
    if (typeof block === 'string' && block === 'empty') {
        return {
            number: null,
            hash: null,
            parentHash: null,
            nonce: null,
            transactionsRoot: '',
            gasLimit: '',
            gasUsed: '',
            timestamp: '0x',
            transactions: [],
            uncles: []
        };
    }

    const { header } = block;

    /**
	 * Get the maximum gas limit allowed in this block. Since gas limit is listed
	 * in each chunk, get the gas limit in each chunk and take the max.
	 * @param {Object} chunks all of a blocks chunks
	 * @returns {Number} Returns max gas limit
	 */
    function getMaxGas(chunks) {
        return chunks.map((c) => c.gas_limit).sort()[0];
    }

    const transactions = this._getTxsFromChunks(block, returnTxObjects, near);



    // call all the chunks and get the transactions

    return {
        // QUANTITTY the block number. 'null' when it's pending block
        number: utils.decToHex(header.height),

        // DATA hash of the block. null when it's pending block
        hash: utils.base58ToHex(header.hash),

        // DATA hash of the parent block
        parentHash: utils.base58ToHex(header.prev_hash),

        // DATA hash of the generated proof-of-work. null when its pending block
        nonce: null,

        // DATA sha3 of the uncles data in the block
        // sha3Uncles: '',

        // DATA the bloom filter for the logs of the block. null when its pending block
        // logsBloom: '',

        // DATA the root of the transaction trie of the block
        // TODO: There is no such thing as transaction trie of the block.
        // Transactions live on chunks, there is a tx_root on each chunk. Could
        // hash all of them into one hash?
        transactionsRoot: '0x00000000000000000000000000000000',

        // DATA the root of the final state trie of the block
        // stateRoot: '',

        // DATA the address of the beneficiary to whom the mining rewards were given
        // miner: '',

        // QUANTITY integer of the difficulty for this block
        // difficulty: null,

        // QUANTITY integer of the total difficulty of the chain until this block
        // totalDifficulty: null,
        // DATA the extra data field of this block
        // extraData: '',
        // QUANTITY integer of the size of this block in bytes
        // size: null,

        // QUANTITY the maximum gas allowed in this block
        gasLimit: utils.decToHex(getMaxGas(block.chunks)),

        // QUANTITY the total used gas by all transactions in this block
        gasUsed: null,

        // QUANTITY the unix timestamp for when the block was collated
        timestamp: utils.convertTimestamp(header.timestamp),

        // ARRAY Array of transaction objects, or 32 bytes transaction hashes
        transactions: [],

        // ARRAY Array of uncle hashes
        uncles: []
    };
};

/**
 * Maps NEAR transaction to ETH Transaction Receipt Object
 * @param {Object} block NEAR block
 * @param {Object} nearTxObj NEAR transaction object
 * @returns {Object} returns ETH transaction receipt object
 */
nearToEth.transactionReceiptObj = function(block, nearTxObj) {
    const responseHash = utils.base64ToString(nearTxObj.status.SuccessValue);
    const { transaction, transaction_outcome } = nearTxObj;

    const gas_burnt = transaction_outcome.outcome.gas_burnt;
    const logs = transaction_outcome.outcome.logs;

    return {
        transactionHash: utils.base58ToHex(transaction.hash),
        transactionIndex: '0x1',
        blockNumber: utils.decToHex(block.header.height),
        blockHash: utils.base58ToHex(block.header.hash),
        contractAddress: '0x' + responseHash.slice(1, responseHash.length - 1),
        gasUsed: utils.decToHex(gas_burnt),
        logs: logs,
        status: '0x1',
    };

};

module.exports = nearToEth;


// get the block
// spread the chunks
// get list of txs from there
