const utils = require('./utils');

const hydrate = {};

/**
 * Get chunks from a block
 * @param {Object} chunk NEAR chunk
 * @param {Object} block NEAR block that contains chunk
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} hydrated chunk with transactions and (sometimes) receipts
 */
hydrate.chunk = async function(chunk, block, nearProvider) {
  // NB: A chunk with no transactions is indicated by chunk.tx_root: '11111111111111111111111111111111'
  const hasNoTxs = '11111111111111111111111111111111';

  // Create promise function to hydrate each chunk ONLY if tx_root !== noTxs
  // Calling this gets all the receipts[] and transactions[] in a chunk
  try {
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
  } catch (e) {
    return new Error('hydrate.chunk:', e);
  }
}

/**
 * Hydrate a block by getting all its transactions
 * NB: These transactions DO NOT contain the transaction_outcome property
 * @param {Object} block  NEAR block
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} returns NEAR block with NEAR transactions array
 */
hydrate.block = async function(block, nearProvider) {
  try {
    // Create promise array of hydrate chunk promises
    const promiseArray = block.chunks.map((chunk) => {
      return hydrateChunk(chunk, block, nearProvider);
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

	let blockWithTxs = block;
	blockWithTxs.transactions = transactions;

	return blockWithTxs;
  } catch (e) {
    return e;
  }
};

/**
 * Hydrate a transaction aka gets the rest of the transaction values not
 * included when querying a chunk: receipts_outcome, status, transaction_outcome
 *
 * @param {Object} block NEAR block with filled transactions
 * @property {Array} block.transactions A block's transactions. If block does
 * not have these, then call hydrate.block
 * @param {Number|Tag} txIndex which tx to hydrate, or 'all' (default)
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object[]} array of hydrated transaction(s)
 */

hydrate.transaction = async function(block, txIndex, nearProvider) {
	assert(
		block.transactions,
		'hydrate.transaction: block must have transactions. Call hydrate.block on block before passing in.'
  );

  try {
    const tx = block.transactions[txIndex];
    const fullTx = await nearProvider.txStatus(utils.hexToUint8(tx), tx.signer_id);

    block.transactions[txIndex] = Object.assign(tx, fullTx);

    return block;
  } catch (e) {
    return new Error('hydrate.transaction:', e);
  }
};

/**
 * Hydrate transactions aka gets the rest of the transaction values not
 * included when querying a chunk: receipts_outcome, status, transaction_outcome
 *
 * @param {Object} block NEAR block with filled transactions
 * @property {Array} block.transactions A block's txs. If block does not have
 * these, then call hydrate.block
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object[]} array of hydrated transactions
 */
hydrate.allTransactions = async function(block, nearProvider) {
  assert(
    block.transactions,
    'hydrate.transaction: block must have transactions. Call hydrate.block on block before passing in.'
  );

  if (transactions.length <= 0) {
    return block;
  }

  try {
    const promiseArray = block.transactions.map((tx, txIndex) =>
      this.transaction(block, txIndex, nearProvider));

    const transactions = await Promise.all(promiseArray);

	block.transactions = transactions;

    return block;
  } catch (e) {
    return new Error('hydrate.allTransactions:', e);
  }
}

module.exports = hydrate;
