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
nearToEth.syncObj = function(syncInfo) {
    return {
        // QUANTITY The current block, same as eth_blockNumber
        currentBlock: utils.decToHex(syncInfo.latest_block_height),

        // QUANTITY The highest estimated block
        // NB: This returns the same as currentBlock, so this is semi-supported
        highestBlock: utils.decToHex(syncInfo.latest_block_height),

        /** ------------ UNSUPPORTED/FALSY VALUES --------- */

        // QUANTITY The block at which the import started (will only be reset,
        // after the sync reached his head)
        startingBlock: '0x0',

        // QUANTITY The estimated states to download
        knownStates: '0x0',

        // QUANTITY The already downloaded states
        pulledStates: '0x0'
    };
};

/**
 * Get the total gas used. gas_used is listed on each chunk
 */
// TODO: Is this chunks.gas_used or accumulated gas_burnt for each tx?
nearToEth._getGasUsed = function(chunks) {
    const gasUsed = chunks.map((c) => c.gas_used);
    const accumulated = gasUsed.reduce((a, b) => a + b);
    return accumulated;
}

/**
 * Maps NEAR Block to ETH Block Object
 * @param {Object|String} block NEAR block. If 'empty', return empty block
 * @param {Boolean} returnTxObjects (optional) default false. if true, return
 * entire transaction object, other just hashes
 * @param {Object} nearProvider NearProvider instance
 * @returns {Object} returns ETH block object
 */
nearToEth.blockObj = async function(block, returnTxObjects, nearProvider) {
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
                transactions = block.transactions.map((tx) => `${tx.hash }:${ tx.signer_id }`);
            } else {
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
            gasUsed: utils.decToHex(this._getGasUsed(block.chunks)),

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
            // uncles: [],

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
    assert(typeof tx === 'object' && tx.hash,
        'nearToEth.transactionObj: must pass in tx object');

    const { transaction_outcome, transaction } = tx;
    let sharedParams = processSharedParams(
        transaction,
        transaction_outcome.block_hash,
        tx.block_height,
        transaction_outcome.outcome.gas_burnt,
        txIndex
    )
    if (sharedParams.value === null) {
        sharedParams.value = transaction.actions.map(v => {
            const k = Object.keys(v)[0];
            return parseInt(v[k].deposit, 10);
        }).reduce((a, b) => a + b);
    }

    return {
        // QUANTITY - the number of txs made by the sender prior to this one
        nonce: utils.decToHex(tx.nonce),

        ...sharedParams,

        // QUANTITY - integer of the current gas price in wei
        // TODO: This will break with big numbers?
        gasPrice: utils.decToHex(parseInt(tx.gas_price)),

        /** ------------ UNSUPPORTED/FALSY VALUES --------- */
        // QUANTITY - ECDSA recovery id
        v: '0x0',
        // QUANTITY - ECDSA signature r
        r: '0x0',
        // QUANTITY - ECDSA signature s
        s: '0x0',
    };
};

/**
 * Maps NEAR transaction to ETH Transaction Receipt Object
 * @param {Object} block NEAR block
 * @param {Object} nearTxObj NEAR transaction object
 * @param {Number} nearTxObjIndex index of NEAR tx in the block
 * @returns {Object} returns ETH transaction receipt object
 */
nearToEth.transactionReceiptObj = function(block, nearTxObj, nearTxObjIndex, accountId) {
    let contractAddress = null;

    const isReceipt = true;
    const { transaction, transaction_outcome, status } = nearTxObj;
    const responseData = utils.base64ToString(status.SuccessValue);
    const functionCall = transaction.actions[0].FunctionCall;

    // if it's deploy, get the address
    if (responseData) {
      const responsePayload = responseData.slice(1, -1);
      if (functionCall && functionCall.method_name == 'deploy_code') {
        contractAddress = responsePayload;
      }
    }

    // TODO: translate logs
    const { gas_burnt } = transaction_outcome.outcome;
    let sharedParams = processSharedParams(
        transaction,
        block.header.hash,
        block.header.height,
        transaction_outcome.outcome.gas_burnt,
        nearTxObjIndex,
        isReceipt,
    )

    return {
        ...sharedParams,

        // DATA The contract address created, if the transaction was a contract
        // creation, otherwise null
        contractAddress: contractAddress,

        // ARRAY Array of log objects, which this transaction generated
        logs: parseLogs(nearTxObj.receipts_outcome, sharedParams, contractAddress),

        // QUANTITY either 1 (success) or 0 (failure)
        status: responseData ? '0x1' : '0x0',

        // QUANTITY The total amount of gas used when this transaction was executed in the block
        // NB: This value is not listed in the RPC
        cumulativeGasUsed: utils.decToHex(this._getGasUsed(block.chunks)),

        /**------------UNSUPPORTED/NULL VALUES--------- */

        // DATA Bloom filter for light clients to quickly retrieve related logs
        logsBloom: `0x${'00'.repeat(256)}`,

        // DATA 32 bytes of post-transaction stateroot (pre Byzantium)
        // txReceipt will return EITHER status or root. Always returns status.
        // root: '0x'
    };
};

function processSharedParams(transaction, blockHash, blockHeight, gasBurnt, txIndex, isReceipt = false) {
    const gas = utils.decToHex(gasBurnt)
    let destination = null;
    let data = null;
    let value = null;

    // function specific parameters
    const functionCall = transaction.actions[0].FunctionCall;
    if (functionCall) {
        const args = JSON.parse(utils.base64ToString(functionCall.args));
        switch (functionCall.method_name) {
            case 'call_contract':
                destination = args.contract_address;
                data = args.encoded_input;
                break;
            case 'deploy_code':
                data = args.bytecode;
                break;
            case 'add_near':
                destination = utils.nearAccountToEvmAddress(transaction.signer_id);
                break;
            case 'move_funds_to_evm_address':
                destination = args.address;
                value = parseInt(args.amount)
                break;
        }
    }

    let transactionHash = `${transaction.hash}:${transaction.signer_id}`
    let obj =  {
        // DATA hash of the block where this transaction was in
        blockHash: utils.base58ToHex(blockHash),
        // QUANTITY block number where this transaction was in
        blockNumber: utils.decToHex(blockHeight),
        // QUANTITY integer of the transaction's position in the block
        transactionIndex: txIndex,
        // DATA address of the sender
        from: utils.nearAccountToEvmAddress(transaction.signer_id),
        // DATA address of the receiver, null when it's a contract creation tx
        to: destination ? utils.include0x(destination) : null,
    }

    let additionalParams
    if (isReceipt) {
        additionalParams = {
            // DATA 32 bytes - Hash of the transaction
            transactionHash,
            // QUANTITY The amount of gas used by this specific transaction alone
            gasUsed: gas,
        }
    } else {
        additionalParams = {
            // DATA 32 bytes - Hash of the transaction
            hash: transactionHash,
            // QUANTITY The amount of gas used by this specific transaction alone
            gas,
            // QUANTITY - value transferred in wei (yoctoNEAR)
            value: value ? utils.decToHex(value) : null,
             // DATA - the data sent along with the transaction
            input: data ? utils.include0x(data) : '',
        }
    }

    return { ...obj, ...additionalParams }
}

function parseLogs(receipts_outcome, params, contractAddress) {
    let nearLogs = receipts_outcome.map(({ outcome }) => outcome.logs).reduce((a, b) => a.concat(b));
    let logs = nearLogs.map((log, i) => {
        return {
            logIndex: '0x' + i.toString(16),
            blockNumber: params.blockNumber,
            blockHash: params.blockHash,
            transactionHash: params.transactionHash,
            transactionIndex: '0x0',
            address: contractAddress || params.to,
            data: '0x' + log.replace(/.*evm log: /, ''),
            topics: []
        };
    });
    return logs;
}

module.exports = nearToEth;
