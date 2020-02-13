/**
 * NEAR chunks mapped to ETH objects and vice versa
 */
const assert = require('bsert');
const utils = require('./utils');
const hydrate = require('./hydrate');

const nearToEth = {
	hydrate
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

    // TODO: Add this back in when EVM contract is deployed
    // const [sender, receiver] = await Promise.all(
    // 	near.nearAccountToEvmAddress(transaction.signer_id),
    // 	near.nearAccountToEvmAddress(transaction.receiver_id)
    // );

    return {
        // DATA 32 bytes - hash of the block where this transaction was in
        blockHash: utils.base58ToHex(transaction.block_hash),

        // QUANTITY block number where this transaction was in
        blockNumber: transaction_outcome
            ? utils.decToHex(transaction_outcome.block_hash)
            : tx.blockNumber,

        // DATA 20 bytes - address of the sender
        // TODO: from: sender
        from: '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368',

        // QUANTITY gas provided by the sender
        gas: utils.decToHex(transaction.outcome.gas_burnt),

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
        value: transaction.actions[0].Transfer.deposit,

        // NB: These are dummy values. I don't think there is a NEAR equivalent
        // QUANTITY - ECDSA recovery id
        v: '0x25',
        // QUANTITY - ECDSA signature r
        r: '0x1b5e176d927f8e9ab405058b2d2457392da3e20f328b16ddabcebc33eaac5fea',
        // QUANTITY - ECDSA signature s
        s: '0x4ba69724e8f69de52f0125ad8b3c5c2cef33019bac3249e2c0a2192766d1721c'
    };
};

/**
 * Maps NEAR Block to ETH Block Object
 * @param {Object|String} block a hydrated NEAR block. If 'empty', return empty block
 * @param {Boolean} returnTxObjects (optional) default false. if true, return
 * entire transaction object, other just hashes
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} returns ETH block object
 */
nearToEth.blockObj = async function(block, returnTxObjects, nearProvider) {
    console.log('-----nearToEth.blockObj')

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

    const transactions = await getTransactions(block, returnTxObjects, nearProvider);

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
        gasUsed: utils.decToHex(getGasUsed(block.chunks)),

        // QUANTITY the unix timestamp for when the block was collated
        timestamp: utils.convertTimestamp(header.timestamp),

        // ARRAY Array of transaction objects, or 32 bytes transaction hashes
        transactions: transactions,

        // ARRAY Array of uncle hashes
        uncles: []
    };

    /**
     * Get the maximum gas limit allowed in this block. Since gas limit is
     * listed in each chunk, get the gas limit in each chunk and take the max.
     * @param {Object} chunks all of a blocks chunks
     * @returns {Number} Returns max gas limit
     */
    function getMaxGas (chunks) {
        return chunks.map((c) => c.gas_limit).sort()[0];
    }

    /**
     * Get the total gas used. gas_used is listed on each chunk
     */
    function getGasUsed (chunks) {
        return chunks.map((c) => c.gas_used).reduce((a, b) => a + b);
    }

    async function getTransactions (block, returnTxObjects, nearProvider) {
        try {
            let transactions = [];

            if (!returnTxObjects) {
                transactions = transactions.map((tx) => tx.transaction.hash);
            } else {
                transactions = await this.hydrate.allTransactions(block, nearProvider);
            }

            return transactions;
        } catch (e) {
            return e;
        }
    }

};

/**
 * Maps NEAR transaction to ETH Transaction Receipt Object
 * @param {Object} block NEAR block
 * @param {Object} nearTxObj NEAR transaction object
 * @returns {Object} returns ETH transaction receipt object
 */
nearToEth.transactionReceiptObj = function(block, nearTxObj) {
    const responseHash = utils.base64ToString(nearTxObj.status.SuccessValue);
    const { transaction } = nearTxObj;

    return {
        transactionHash: utils.base58ToHex(transaction.hash),
        transactionIndex: '0x1',
        blockNumber: utils.decToHex(block.number),
        blockHash: utils.base58ToHex(block.hash),
        contractAddress: '0x' + responseHash.slice(1, responseHash.length - 1),
        gasUsed: utils.decToHex(transaction.outcome.gas_burnt),
        logs: transaction.outcome.logs,
        status: '0x1',
    };

};

module.exports = nearToEth;


// get the block
// spread the chunks
// get list of txs from there
