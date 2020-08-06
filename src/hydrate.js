const utils = require('./utils');
const assert = require('bsert');

const hydrate = {};

/**
 * Get chunks from a block
 * @param {Object} chunk NEAR chunk
 * @param {Object} block NEAR block that contains chunk
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} hydrated chunk with transactions and (sometimes) receipts
 */
hydrate.chunk = async function(chunk, block, nearProvider) {
    // NB: A chunk with no transactions is indicated by an empty chunk.tx_root
    const hasNoTxs = utils.emptyResult;

    // Create promise function to hydrate each chunk ONLY if tx_root !== noTxs
    // Calling this gets all the receipts[] and transactions[] in a chunk
    let hydratedChunk;
    if (chunk.tx_root === hasNoTxs) {
        hydratedChunk = chunk;
        hydratedChunk.transactions = [];
    } else {
        hydratedChunk = await nearProvider.chunk(chunk.chunk_hash);
    }

    // Add for convenience and to prevent multiple queries
    hydratedChunk.block_hash = block.header.hash;
    hydratedChunk.block_height = block.header.height;
    hydratedChunk.gas_price = block.header.gas_price;

    return hydratedChunk;
};

/**
 * Hydrate a block by getting all its transactions
 * NB: These transactions DO NOT contain the transaction_outcome property
 * @param {Object} block  NEAR block
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} returns NEAR block with NEAR transactions array
 */
hydrate.block = async function(block, nearProvider) {
    // console.log('---------hydrate.block');
    // Create promise array of hydrate chunk promises
    const promiseArray = block.chunks.map((chunk) => {
        return this.chunk(chunk, block, nearProvider);
    });

    // Hydrate the chunks
    const hydratedChunks = await Promise.all(promiseArray);

    let transactions = [];

    // Get all the transactions from each chunk and push it into one array
    hydratedChunks.forEach((chunk) => {
        chunk.transactions.forEach((tx) => {
            // Add these from hydrateChunk() for convenience
            tx.block_height = chunk.block_height;
            tx.gas_price = chunk.gas_price;

            transactions.push(tx);
        });
    });

    // console.log({transactions})

    let blockWithTxs = block;
    blockWithTxs.transactions = transactions;

    return blockWithTxs;
};

/**
 * Hydrate a transaction aka gets the rest of the transaction values not
 * included when querying a chunk: receipts_outcome, status, transaction_outcome
 *
 * @param {Object} block NEAR block with filled transactions
 * @property {Array} block.transactions A block's transactions. If block does
 * not have these, then call hydrate.block
 * @param {Number|String} txIndex which tx to hydrate
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} hydrated transaction
 */

hydrate.transaction = async function(block, txIndex, nearProvider) {
    assert(
        block.transactions,
        'hydrate.transaction: block must have transactions. Call hydrate.block on block before passing in.'
    );

    const tx = block.transactions[txIndex];

    const fullTx = await nearProvider.txStatus(utils.base58ToUint8(tx.hash), tx.signer_id);

    // TODO: Clean this up later.
    const hydratedTx = Object.assign(tx, fullTx);

    return hydratedTx;
};

/**
 * Hydrate transactions aka gets the rest of the transaction values not
 * included when querying a chunk: receipts_outcome, status, transaction_outcome
 *
 * @param {Object} block hydrated NEAR block with filled transactions
 * @property {Array} block.transactions A block's txs. If block does not have
 * these, then call hydrate.block
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object[]} array of hydrated transactions
 */
hydrate.allTransactions = async function(block, nearProvider) {
    // console.log('-----------hydrate.allTransactions');
    assert(
        block.transactions,
        'hydrate.transaction: block must have transactions. Call hydrate.block on block before passing in.'
    );

    if (block.transactions.length <= 0) {
        return [];
    }

    try {
        const promiseArray = block.transactions.map((tx, txIndex) => {
            return this.transaction(block, txIndex, nearProvider);
        });

        const transactions = await Promise.all(promiseArray);

        return transactions;
    } catch (e) {
        return e;
    }
};

module.exports = hydrate;
