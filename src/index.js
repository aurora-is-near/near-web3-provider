const BN = require('bn.js');
const assert = require('bsert');
const nearlib = require('nearlib');

const NEAR_NET_VERSION = '99';
const NEAR_NET_VERSION_TEST = '98';

const utils = require('./utils');
const nearToEth = require('./near_to_eth_objects');

const GAS_AMOUNT = new BN('1000000000000000000');

class NearProvider {
    constructor(url, keyStore, accountId, networkId, evmContractName) {
        this.networkId = networkId || process.env.NODE_ENV || 'default';
        this.evm_contract = evmContractName || 'evm';
        this.url = url;
        this.version = networkId === 'local' || networkId === 'test'
            ? NEAR_NET_VERSION_TEST
            : NEAR_NET_VERSION;
        this.nearProvider = new nearlib.providers.JsonRpcProvider(url);

        this.keyStore = keyStore;
        this.signer = new nearlib.InMemorySigner(this.keyStore);

        this.connection = new nearlib.Connection(this.networkId, this.nearProvider, this.signer);
        this.accountId = accountId;
        this.account = new nearlib.Account(this.connection, accountId);
        this.accountEvmAddress = utils.nearAccountToEvmAddress(this.accountId);
    }

    async _createNewAccount(accountId) {
        // create keypair
        const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
        await this.keyStore.setKey(this.networkId, accountId, keyPair);
        this.accounts[accountId] = new nearlib.Account(this.connection, accountId);
        this.signer = new nearlib.InMemorySigner(this.keyStore);
        this.connection = new nearlib.Connection(this.networkId, this.nearProvider, this.signer);
    }

    async _viewEvmContract(method, methodArgs) {
        try {
            const result = await this.account.viewFunction(
                this.evm_contract,
                method,
                methodArgs
            );
            return result;
        } catch (e) {
            return e;
        }
    }

    /**
     * Calls a block and fills it up
     */
    async _getBlock(blockHeight, returnTxObjects) {
        try {
            const block = await this.nearProvider.block(blockHeight);
            const fullBlock = await nearToEth.blockObj(block, returnTxObjects, this.nearProvider);

            return fullBlock;
        } catch (e) {
            return e;
        }
    }

    unsupportedMethodErrorMsg(method) {
        return `NearProvider: ${method} is unsupported.`;
    }

    // Maps ethereum RPC into NEAR RPC requests and remaps back the responses.
    async routeRPC(method, params) {
        switch (method) {

        /**
         * Returns the current network id
         * @returns {String}
         */
        case 'net_version': {
            return this.version;
        }

        case 'net_listening': {
            return this.routeNetListening(params);
        }

        case 'eth_syncing': {
            return this.routeEthSyncing(params);
        }

        case 'eth_gasPrice': {
            return this.routeEthGasPrice(params);
        }

        case 'eth_accounts': {
            return this.routeEthAccounts(params);
        }

        case 'eth_blockNumber': {
            return this.routeEthBlockNumber(params);
        }

        case 'eth_getBalance': {
            return this.routeEthGetBalance(params);
        }

        case 'eth_getStorageAt': {
            return this.routeEthGetStorageAt(params);
        }

        case 'eth_getCode': {
            return this.routeEthGetCode(params);
        }

        case 'eth_getBlockByHash': {
            return this.routeEthGetBlockByHash(params);
        }

        case 'eth_getBlockByNumber': {
            return this.routeEthGetBlockByNumber(params);
        }

        case 'eth_getBlockTransactionCountByHash': {
            return this.routeEthGetBlockTransactionCountByHash(params);
        }

        case 'eth_getBlockTransactionCountByNumber': {
            return this.routeEthGetBlockTransactionCountByNumber(params);
        }

        case 'eth_getTransactionByHash': {
            return this.routeEthGetTransactionByHash(params);
        }

        case 'eth_getTransactionByBlockHashAndIndex': {
            return this.routeEthGetTransactionByBlockHashAndIndex(params);
        }

        case 'eth_getTransactionByBlockNumberAndIndex': {
            return this.routeEthGetTransactionByBlockNumberAndIndex(params);
        }

        case 'eth_getTransactionReceipt': {
            return this.routeEthGetTransactionReceipt(params);
        }

        case 'eth_getTransactionCount': {
            return this.routeEthGetTransactionCount(params);
        }

        case 'eth_sendTransaction': {
            return this.routeEthSendTransaction(params);
        }

        case 'eth_sendRawTransaction': {
            return this.routeEthSendRawTransaction(params);
        }

        case 'eth_call': {
            return this.routeEthCall(params);
        }

        /**
         * Always 0
         */
        case 'eth_estimateGas': {
            return '0x0';
        }

        /**-----------UNSUPPORTED METHODS------------**/
        case 'eth_sign': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getPastLogs': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_pendingTransactions': {
            // return [];
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getUncleByBlockHashAndIndex': {
            // return nearToEth.blockObj('empty');
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getUncleByBlockNumberAndIndex': {
            // return nearToEth.blockObj('empty');
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_newFilter': {
            // return '0x0';
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_newBlockFilter': {
            // return '0x0';
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_newPendingTransactionFilter': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_uninstallFilter': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getFilterChanges': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getFilterLogs': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getWork': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_submitWork': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_submitHashrate': {
            throw new Error(this.unsupportedMethodErrorMsg(method));
        }
        }
        throw new Error(`NearProvider: Unknown method: ${method} with params ${params}`);
    }

    sendAsync(payload, cb) {
        this.routeRPC(payload['method'], payload['params']).then((result) => {
            cb(null, {
                id: payload['id'],
                jsonrpc: '2.0',
                result
            });
        }, (err) => {
            console.error(err);
            new Error(`NearProvider: ${err}`);
        });
    }

    send(payload, cb) {
        this.routeRPC(payload['method'], payload['params']).then((result) => {
            cb(null, {
                id: payload['id'],
                jsonrpc: 2.0,
                result
            });
        }, (err) => {
            console.error(err);
            throw new Error(`NearProvider: ${err}`);
        });
    }

    disconnect() {
        // NO OP.
    }

    getAddress(idx) {
        // TODO: return proper addresses.
        console.warn('getAddress');
        console.warn(idx);
    }

    getAddresses() {
        // TODO: return proper addresses.
        return [];
    }

    supportsSubscriptions() {
        return false;
    }

    /**
     * Returns true if client is actively listening for network
     * connections
     * @returns {boolean}
     */
    async routeNetListening() {
        try {
            const status = await this.nearProvider.status();
            if (status) {
                return true;
            } else {
                return false;
            }
        } catch (e) {
            return e;
        }
    }

    /**
     * Checks if the node is currently syncing
     * @returns {Object|boolean} a sync object when the node is
     * currently syncing or 'false'
     */
    async routeEthSyncing() {
        try {
            const { sync_info } = await this.nearProvider.status();
            if (!sync_info.syncing) {
                return false;
            } else {
                return nearToEth.syncObj(sync_info);
            }
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the current price per gas in yoctoNEAR
     * @returns {Quantity} integer of the current gas price in
     * yoctoNEAR
     */
    async routeEthGasPrice() {
        try {
            const { sync_info: { latest_block_hash } } = await this.nearProvider.status();
            const result = await this.nearProvider.block(latest_block_hash);

            return new BN(result.header.gas_price);
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns a list of addresses owned by client/accounts the node
     * controls
     * @returns {String[]} array of 0x-prefixed 20 byte addresses
     */
    // TODO: Is this useful? will web3 let us pass back Near accountIds?
    async routeEthAccounts() {
        try {
            const networkId = this.connection.networkId;
            const accounts = await this.keyStore.getAccounts(networkId);

            const evmAccounts = accounts.map(utils.nearAccountToEvmAddress);
            return evmAccounts;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the number of the most recent block
     * @returns {Quantity} integer of the current block number the
     * client is on
     */
    async routeEthBlockNumber() {
        try {
            const status = await this.nearProvider.status();
            return utils.decToHex(status.sync_info.latest_block_height);
        } catch (e) {
            return e;
        }
    }

    /**
     * Gets the balance of an address at a given block
     * @param {String} address Address to check for balance
     * @returns {Quantity} integer of the current balance in wei
     */
    async routeEthGetBalance(params) {
        const address = utils.remove0x(params[0]);
        try {
            const balance = await this._viewEvmContract(
                'balance_of_evm_address',
                { address }
            );
            return '0x' + new BN(balance, 10).toString(16);
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the value from a storage position at a given address.
     * @param {String} address 20-byte address of the storage
     * @param {Quantity} position The index position of the storage
     * @returns {String} The value at this storage position
     */
    async routeEthGetStorageAt([address, position]) {
        try {
            // string magic makes a fixed-length hex string from the int
            const key = `${'00'.repeat(32)}${utils.remove0x(position.toString(16))}`.slice(-64);
            address = utils.remove0x(address);

            let result = await this._viewEvmContract(
                'get_storage_at',
                { address, key }
            );
            return `0x${result}`;
        } catch (e) {
            return ;
        }
    }

    /**
     * Gets the code at a specific address
     * @param {String} address 20-byte address to get the code from
     */
    async routeEthGetCode([address]) {
        try {
            address = utils.remove0x(address);
            let result = await this._viewEvmContract(
                'get_code',
                { address });
            return '0x' + result;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns block
     * web3.eth.getBlock accepts either a hash or a number.
     * Block hash params are handled here
     * @param {String} blockHash hex equivalent of a NEAR block hash
     * @param {Boolean} returnTxObjects (optional) default: false. if
     * true returns the full transaction objects, else false.
     * @returns {Object} returns block object
     */
    async routeEthGetBlockByHash([blockHash, returnTxObjects]) {
        try {
            // console.log('gethash', blockHash);
            assert(blockHash, 'Must pass in blockHash');
            blockHash = utils.hexToBase58(blockHash);
            const block = await this._getBlock(blockHash, returnTxObjects);

            return block;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns block object
     * web3.eth.getBlock accepts either a hash, number, or string.
     * Number and string params are handled here.
     * @param {Quantity|Tag} height block height or enum string
     * 'genesis', 'latest', 'earliest', or 'pending'
     * @param {Boolean} returnTxObjects (optional) default: false. if
     * true returns the full transaction objects, else false.
     * @returns {Object} returns block object
     */
    async routeEthGetBlockByNumber([blockHeight, returnTxObjects]) {
        try {
            blockHeight = await utils.convertBlockHeight(blockHeight, this.nearProvider);
            const block = await this._getBlock(blockHeight, returnTxObjects);

            return block;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the number of transactions in a block from a block
     * matching the given block hash.
     * web3.eth.getBlockTransactionCount accepts either a hash, number,
     * or string.
     * Hash params are handled here
     * @param {String} blockHash 32-byte block hash
     * @returns {Quantity} Integer of the number of txs in this block
     */
    async routeEthGetBlockTransactionCountByHash([blockHash]) {
        try {
            blockHash = utils.hexToBase58(blockHash);
            const block = await this._getBlock(blockHash);
            const txCount = block.transactions.length;

            return utils.decToHex(txCount);
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the number of transactions in a block from a block
     * matching the given number or string
     * web3.eth.getBlockTransactionCount accepts either a hash, number,
     * or string.
     * Number and string params are handled here
     * @param {String} blockHeight 32-byte block hash
     * @returns {Quantity} Integer of the number of txs in this block
     */
    async routeEthGetBlockTransactionCountByNumber([blockHeight]) {
        try {
            blockHeight = await utils.convertBlockHeight(blockHeight, this.nearProvider);
            const block = await this._getBlock(blockHeight);

            const txCount = block.transactions.length;
            return utils.decToHex(txCount);
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the transaction requested by a transaction hash
     * @param {String} txHashAndAccountId transaction hash + accountId,
     * separated by ':'
     * @returns {Object} returns transaction object
     */
    // TODO: Update accountID references to be signerID (more explicit)
    async routeEthGetTransactionByHash([txHashAndAccountId]) {
        try {
            // NB: provider.txStatus requires txHash to be a Uint8Array of
            //     the base58 tx hash. Since txHash is hex, it is converted to
            //     base58, and then turned into a Buffer
            let { txHash, accountId } = utils.getTxHashAndAccountId(txHashAndAccountId);
            accountId = accountId || this.accountId;
            const { transaction_outcome: { block_hash }} = await this.nearProvider.txStatus(
                utils.base58ToUint8(txHash),
                accountId
            );
            const block = await this._getBlock(block_hash, true);
            const findTx = block.transactions.find((t) => t.hash === txHashAndAccountId);

            return findTx;
        } catch (e) {
            if (e.type == 'TimeoutError') {
                // NB: Near RPC won't respond null. It'll timeout.
                //     So if it times out, the tx doesn't exist
                return null;
            }
            return e;
        }
    }

    /**
     * Returns a transaction based on a block hash and the transactions
     * index position
     * web3.eth.getTransactionFromBlock accepts either a hash, number,
     * or string.
     * Hash params are handled here
     * @param {String} blockHash 32-byte block hash
     * @param {Number} txIndex transaction's index position
     * @returns {Object} returns transaction object
     */
    // TODO: Fix to get transactions from chunks
    async routeEthGetTransactionByBlockHashAndIndex([blockHash, txIndex]) {
        try {
            blockHash = utils.hexToBase58(blockHash);
            txIndex = utils.hexToDec(txIndex);

            assert(blockHash, 'Must pass in block hash as first argument');
            assert(txIndex !== undefined && typeof txIndex === 'number', 'Must pass in tx index as second argument');

            const block = await this._getBlock(blockHash, true);

            const tx = block.transactions[txIndex];
            return tx || null;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns a transaction based on a block number or enum string and
     * the transactions index position
     * web3.eth.getTransactionFromBlock accepts either a hash, number,
     * or string.
     * Number and string params are handled here
     * @param {String} blockHeight block number or enum string
     * @param {Number} txIndex transaction's index position
     * @returns {Object} returns transaction object
     */
    async routeEthGetTransactionByBlockNumberAndIndex([blockHeight, txIndex]) {
        try {
            txIndex = utils.hexToDec(txIndex);

            assert(txIndex !== undefined, 'Must pass in tx index as second argument');
            assert(blockHeight, 'Must pass in block height as first argument');

            blockHeight = await utils.convertBlockHeight(blockHeight, this.nearProvider);

            const block = await this._getBlock(blockHeight, true);
            const tx = block.transactions[txIndex];

            return tx || null;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the receipt of a transaction by transaction hash
     * @param {String} txHash transaction hash
     * @returns {Object} returns transaction receipt object or null
     */
    async routeEthGetTransactionReceipt([txHashAndAccountId]) {
        try {
            let { txHash, accountId } = utils.getTxHashAndAccountId(txHashAndAccountId);
            let tx = await this.nearProvider.txStatus(utils.base58ToUint8(txHash), accountId);
            let block = await this.nearProvider.block(tx.transaction_outcome.block_hash);
            const result = nearToEth.transactionReceiptObj(block, tx, accountId);
            return result;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the number of transactions SENT from an address
     * @param {String} address 20-byte address
     * @returns {Quantity} Integer of the number of transactions sent
     * from this address
     */
    async routeEthGetTransactionCount([address]) {
        try {
            address = utils.remove0x(address);

            let result = await this._viewEvmContract(
                'nonce_of_evm_address',
                { address }
            );
            return `0x${new BN(result, 10).toString(16)}`;
        } catch (e) {
            return e;
        }
    }

    /**
     * Creates new message call transaction or a contract creation, if
     * the data field contains code, pass it through
     * web3.eth.sendTransaction
     *
     * @param    {Object} txObj transaction object
     * @property {String} params.to EVM destination address
     * @property {String} params.value amount of yoctoNEAR to attach
     * @property {String} params.gas amount of gas to attach
     * @property {String} params.data the encoded call data
     * @returns  {String} The resulting txid
     */
    async routeEthSendTransaction([txObj]) {
        try {
            let outcome;

            const { to, value, data } = txObj;
            let val = value === undefined
                ? new BN(0)
                : new BN(utils.remove0x(value), 16);

            // TODO: differentiate simple sends

            if (to === undefined) {
                // Contract deployment.
                outcome = await this.account.functionCall(
                    this.evm_contract,
                    'deploy_code',
                    { 'bytecode': utils.remove0x(data) },
                    GAS_AMOUNT.toString(),
                    val.toString()
                );
            } else {
                outcome = await this.account.functionCall(
                    this.evm_contract,
                    'call_contract',
                    { contract_address: utils.remove0x(to), encoded_input: utils.remove0x(data) },
                    GAS_AMOUNT.toString(),
                    val.toString()
                );
            }
            return `${outcome.transaction_outcome.id}:${this.accountId}`;
        } catch (e) {
            return e;
        }
    }

    /**
     * web3.eth.sendSignedTransaction
     * Creates new message call transaction or a contract creation for
     * signed transactions
     * @param {String} txData the signed transaction data
     * @returns {String} returns the 32-byte transaction hash, or the
     * zero hash if the transaction is not yet available
     */
    async routeEthSendRawTransaction(/* params */) {
        // const txData = params[0];
        // https://docs.nearprotocol.com/docs/interaction/rpc#send-transaction-wait-until-done
        // TODO: this ^
        return '0x';
    }

    /**
     * Executes a new message call immediately without creating a
     * transaction on the block chain
     * @param {Object} txCallObj transaction call object
     * @property {String} to the address the tx is directed to
     * @property {String} from (optional) the address the tx is sent from
     * @property {Quantity} value (optional) integer of the value sent
     * with this tx
     * @property {String} data (optional) hash of the method signature
     * and encoded parameters
     * @returns {String} the return value of the executed contract
     */
    async routeEthCall([txCallObj]) {
        try {
            const { to, from, value, data } = txCallObj;
            const sender = from
                ? from
                : utils.nearAccountToEvmAddress(this.accountId);

            const val = value
                ? new BN(utils.remove0x(value), 16)
                : new BN(0);
            const result = await this._viewEvmContract(
                'view_call_contract',
                {
                    contract_address: utils.remove0x(to),
                    encoded_input: utils.remove0x(data),
                    sender: utils.remove0x(sender),
                    value: val.toString()
                });
            return '0x' + result;
        } catch (e) {
            return ;
        }
    }
}

module.exports = { NearProvider, nearlib };
