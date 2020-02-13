/**
 * NEAR chunks mapped to ETH objects and vice versa
 */
const assert = require('bsert');
const utils = require('./utils');
const hydrate = require('./hydrate');
const BN = require('bn.js');

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
 * @returns {Object} returns ETH transaction object
 *
 * @example nearToEth.transactionObject(tx, txIndex)
 */
nearToEth.transactionObj = async function(tx, txIndex) {
    assert(typeof tx === 'object' && tx.hash, 'nearToEth.transactionObj: must pass in tx object');

    const { transaction_outcome, transaction } = tx;

    // const sender = utils.nearAccountToEvmAddress(transaction.signer_id);
    // const receiver = utils.nearACcountToEvmAddress(transaction.receiver_id);
    const value = transaction.actions.map(v => {
        const k = Object.keys(v)[0];
        return parseInt(v[k].deposit, 10);
    }).reduce((a, b) => a + b);

    const obj = {
        // DATA 20 bytes - address of the sender
        // from: sender,
        // TODO: PUt this back to sender when we figure out contract stuff
        from: '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368',

        // DATA 20 bytes - address of the receiver
        // TODO: to: receiver
        to: '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368',

        // QUANTITY - integer of the current gas price in wei
        // TODO: Will this break with big numbers?
        gasPrice: utils.decToHex(parseInt(tx.gas_price)),

        // DATA - the data sent along with the transaction
        // TODO: Would a comparison be for transaction.actions[i]?
        input: '0x',

        // DATA 32 bytes - hash of the block where this transaction was in
        blockHash: utils.base58ToHex(transaction_outcome.block_hash),

        // QUANTITY block number where this transaction was in
        blockNumber: utils.decToHex(tx.block_height),

        // QUANTITY gas provided by the sender
        gas: utils.decToHex(transaction_outcome.outcome.gas_burnt),

        // DATA 32 bytes - hash of the transaction
        hash: utils.base58ToHex(tx.hash),

        // QUANTITY - the number of txs made by the sender prior to this one
        nonce: utils.decToHex(tx.nonce),

        // QUANTITY - integer of the tx's index position in the block
        transactionIndex: utils.decToHex(txIndex),

        // QUANTITY - value transferred in wei (yoctoNEAR)
        value: utils.decToHex(value),

        /** ------------ UNSUPPORTED DUMMY VALUES --------- */
        // QUANTITY - ECDSA recovery id
        v: '0x0',
        // QUANTITY - ECDSA signature r
        r: '0x0',
        // QUANTITY - ECDSA signature s
        s: '0x0'
    };

    return obj;
};

/**
 * Maps NEAR Block to ETH Block Object
 * @param {Object|String} block NEAR block. If 'empty', return empty block
 * @param {Boolean} returnTxObjects (optional) default false. if true, return
 * entire transaction object, other just hashes
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} returns ETH block object
 */
nearToEth.blockObj = async function(block, returnTxObjects, nearProvider) {
    // console.log('-----nearToEth.blockObj');
    try {
        block = await this.hydrate.block(block, nearProvider);

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
                transactions: []
            };
        }

        const { header } = block;

        let transactions;

        if (block.transactions.length <= 0) {
            transactions = [];
        } else {
            if (!returnTxObjects) {
                // console.log('Just hashes');
                transactions = block.transactions.map((tx) => utils.base58ToHex(tx.hash));
            } else {
                // console.log('everything');
                const hydratedTransactions = await hydrate.allTransactions(block, nearProvider);

                const promiseArray = hydratedTransactions.map((tx, txIndex) => {
                    return this.transactionObj(tx, txIndex);
                });

                transactions = await Promise.all(promiseArray);
            }
        }

        return {
            /**---------------- TODO: --------------- */

            // DATA hash of the generated proof-of-work. null when its pending block
            // TODO: What is this equivalent?
            nonce: null,

            // DATA the root of the transaction trie of the block
            // TODO: There is no such thing as transaction trie of the block.
            // Transactions live on chunks, there is a tx_root on each chunk. Could
            // hash all of them into one hash?
            transactionsRoot: '0x00000000000000000000000000000000',

            // TODO: is this block.header.total_weight?
            // QUANTITY integer of the size of this block in bytes
            // size: '',

            // QUANTITTY the block number. 'null' when it's pending block
            number: utils.decToHex(header.height),

            // DATA hash of the block. null when it's pending block
            hash: utils.base58ToHex(header.hash),

            // DATA hash of the parent block
            parentHash: utils.base58ToHex(header.prev_hash),

            // QUANTITY the maximum gas allowed in this block
            gasLimit: utils.decToHex(getMaxGas(block.chunks)),

            // QUANTITY the total used gas by all transactions in this block
            gasUsed: utils.decToHex(getGasUsed(block.chunks)),

            // QUANTITY the unix timestamp for when the block was collated
            timestamp: utils.convertTimestamp(header.timestamp),

            // ARRAY Array of transaction objects, or 32 bytes transaction hashes
            transactions: transactions

            /**------------UNSUPPORTED VALUES--------- */
            // DATA sha3 of the uncles data in the block
            // sha3Uncles: '',

            // DATA the bloom filter for the logs of the block. null when its pending block
            // logsBloom: '',

            // ARRAY Array of uncle hashes
            // uncles: []

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
        };
    } catch (e) {
        return e;
    }

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
    // TODO: Is this chunks.gas_used or accumulated gas_burnt for each tx?
    function getGasUsed (chunks) {
        const gasUsed = chunks.map((c) => c.gas_used);
        // console.log({gasUsed})
        const accumulated = gasUsed.reduce((a, b) => a + b);
        // console.log({accumulated})
        return accumulated;
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
