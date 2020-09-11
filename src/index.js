const BN = require('bn.js');
const assert = require('bsert');
const web3Utils = require('web3-utils');
const nearAPI = require('near-api-js');
const { Account } = require('near-api-js');
var sigUtil = require('eth-sig-util');

const utils = require('./utils');
const nearToEth = require('./near_to_eth_objects');
const nearWeb3Extensions = require('./near_web3_extensions');
const consts = require('./consts');

class NearProvider {
    constructor(params) {
        const {
            nodeUrl, keyStore, masterAccountId, networkId, evmAccountId
        } = params;
        this.networkId = networkId || process.env.NEAR_ENV || 'default';
        this.evm_contract = evmAccountId || 'evm';
        this.url = nodeUrl;
        this.version = networkId === 'local' || networkId === 'test'
            ? consts.NEAR_NET_VERSION_TEST
            : consts.NEAR_NET_VERSION;
        this.nearProvider = new nearAPI.providers.JsonRpcProvider(this.url);

        // TODO: make sure this works in the browser, when disk is not available.
        this.keyStore = keyStore || utils.createLocalKeyStore(this.networkId, params.keyPath);
        this.signer = new nearAPI.InMemorySigner(this.keyStore);

        this.connection = new nearAPI.Connection(this.networkId, this.nearProvider, this.signer);
        this.accountId = masterAccountId;
        assert(this.accountId !== undefined && this.accountId !== null, 'Must pass master account id');
        this.account = new nearAPI.Account(this.connection, this.accountId);
        this.accountEvmAddress = utils.nearAccountToEvmAddress(this.accountId);
        this.accounts = new Map();
        this.accounts.set(this.accountId, this.account);

        if (params.numTestAccounts) {
            // Creates test accounts if given parameter is passed.
            utils.createTestAccounts(this.account, params.numTestAccounts)
                .then(() => {}).catch((error) => { throw error });
        }
    }

    async _createNewAccount(accountId) {
        // Create keypair.
        const keyPair = await nearAPI.KeyPair.fromRandom('ed25519');
        await this.keyStore.setKey(this.networkId, accountId, keyPair);
        this.accounts[accountId] = new nearAPI.Account(this.connection, accountId);
    }

    async _viewEvmContract(method, methodArgs) {
        const result = await utils.rawViewCall(
            this.account,
            this.evm_contract,
            method,
            methodArgs
        );
        return result;
    }

    /** Returns account id for given address, if this account is known. */
    async _addressToAccountId(address) {
        // TODO: optimize & cache this.
        let accounts = await this.keyStore.getAccounts(this.networkId);
        let addressToAccountId = new Map();
        accounts.forEach((account) => addressToAccountId.set(utils.nearAccountToEvmAddress(account), account));
        return addressToAccountId.get(address);
    }

    _getAccount(accountId) {
        if (!this.accounts.has(accountId)) {
            this.accounts.set(accountId, new Account(this.connection, accountId));
        }
        return this.accounts.get(accountId);
    }

    /**
     * Calls a block and fills it up
     */
    async _getBlock(blockId, returnTxObjects, returnNearBlock) {
        const block = await this.nearProvider.block({ blockId });
        const fullBlock = await nearToEth.blockObj(block, returnTxObjects, this.nearProvider);

        if (returnNearBlock) {
            return [fullBlock, block];
        }
        return fullBlock;
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

        case 'eth_protocolVersion': {
            return this.routeEthProtocolVersion(params);
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

        // TODO: this is a hack and has hardcoded values
        case 'eth_getLogs': {
            return this.routeEthGetLogs(params);
        }

        case 'eth_getTransactionCount': {
            return this.routeEthGetTransactionCount(params);
        }

        case 'eth_sendTransaction': {
            return this.routeEthSendTransaction(params);
        }

        case 'near_retrieveNear': {
            return this.routeNearRetrieveNear(params);
        }

        case 'near_transferNear': {
            return this.routeNearTransferNear(params);
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

        case 'eth_signTypedData': {
            return this.signTypedData(params);
        }

        /**-----------UNSUPPORTED METHODS------------**/
        case 'eth_sign': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getPastLogs': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_pendingTransactions': {
            // return [];
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getUncleByBlockHashAndIndex': {
            // return nearToEth.blockObj('empty');
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getUncleByBlockNumberAndIndex': {
            // return nearToEth.blockObj('empty');
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_newFilter': {
            // return '0x0';
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_newBlockFilter': {
            // return '0x0';
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_newPendingTransactionFilter': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_uninstallFilter': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getFilterChanges': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getFilterLogs': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_getWork': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_submitWork': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        case 'eth_submitHashrate': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        default: {
            return new Error(`NearProvider: Unknown method: ${method} with params ${JSON.stringify(params)}`);
        }
        }
    }

    sendAsync(payload, cb) {
        this.routeRPC(payload['method'], payload['params']).then((result) => {
            cb(null, {
                id: payload['id'],
                jsonrpc: '2.0',
                result
            });
        }, (err) => {
            cb(err);
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
            cb(err);
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
        const status = await this.nearProvider.status();
        if (status) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Returns the current NEAR protocol version
     * @returns {String} the current NEAR protocol version
     */
    async routeEthProtocolVersion() {
        const { version } = await this.nearProvider.status();
        return web3Utils.toHex(version.version);
    }

    /**
     * Checks if the node is currently syncing
     * @returns {Object|boolean} a sync object when the node is
     * currently syncing or 'false'
     */
    async routeEthSyncing() {
        const { sync_info } = await this.nearProvider.status();
        if (!sync_info.syncing) {
            return false;
        } else {
            return nearToEth.syncObj(sync_info);
        }
    }

    /**
     * Returns the current price per gas in yoctoNEAR
     * @returns {Quantity} integer of the current gas price in
     * yoctoNEAR
     */
    async routeEthGasPrice() {
        const { sync_info: { latest_block_hash } } = await this.nearProvider.status();
        const result = await this.nearProvider.block({ blockId: latest_block_hash});

        return new BN(result.header.gas_price);
    }

    /**
     * Returns a list of addresses owned by client/accounts the node
     * controls
     * @returns {String[]} array of 0x-prefixed 20 byte addresses
     */
    async routeEthAccounts() {
        const networkId = this.connection.networkId;
        let accounts = await this.keyStore.getAccounts(networkId);

        // The main account should go first.
        accounts = [this.accountId].concat(accounts.filter((accountId) => accountId !== this.accountId));

        const evmAccounts = accounts.map(utils.nearAccountToEvmAddress);
        return evmAccounts;
    }

    /**
     * Returns the number of the most recent block
     * @returns {Quantity} integer of the current block number the
     * client is on
     */
    async routeEthBlockNumber() {
        const status = await this.nearProvider.status();
        return utils.decToHex(status.sync_info.latest_block_height);
    }

    /**
     * Gets the balance of an address at a given block
     * @param {String} address Address to check for balance
     * @returns {Quantity} integer of the current balance in wei
     */
    async routeEthGetBalance(params) {
        const result = await this._viewEvmContract(
            consts.GET_BALANCE_METHOD_NAME,
            utils.deserializeHex(params[0])
        );
        return `0x${Buffer.from(result).toString('hex')}`;
    }

    /**
     * Returns the value from a storage position at a given address.
     * @param {String} address 20-byte address of the storage
     * @param {Quantity} position The index position of the storage
     * @returns {String} The value at this storage position
     */
    async routeEthGetStorageAt([address, position]) {
        // string magic makes a fixed-length hex string from the int
        const key = `${'00'.repeat(32)}${utils.remove0x(position.toString(16))}`.slice(-64);

        let result = await this._viewEvmContract(
            consts.GET_STORAGE_AT_METHOD_NAME,
            utils.encodeStorageAtArgs(address, key)
        );
        return `0x${Buffer.from(result).toString('hex')}`;
    }

    /**
     * Gets the code at a specific address
     * @param {String} address 20-byte address to get the code from
     */
    async routeEthGetCode([address]) {
        let result = await this._viewEvmContract(
            consts.GET_CODE_METHOD_NAME, utils.deserializeHex(address));
        return `0x${Buffer.from(result).toString('hex')}`;
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
        assert(blockHash, 'Must pass in blockHash');
        blockHash = utils.hexToBase58(blockHash);
        const block = await this._getBlock(blockHash, returnTxObjects);

        return block;
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
        blockHeight = await utils.convertBlockHeight(blockHeight, this.nearProvider);
        const block = await this._getBlock(blockHeight, returnTxObjects);

        return block;
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
        blockHash = utils.hexToBase58(blockHash);
        const block = await this._getBlock(blockHash);
        const txCount = block.transactions.length;

        return utils.decToHex(txCount);
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
        blockHeight = await utils.convertBlockHeight(blockHeight, this.nearProvider);
        const block = await this._getBlock(blockHeight);

        const txCount = block.transactions.length;
        return utils.decToHex(txCount);
    }

    /**
     * Returns the transaction requested by a transaction hash
     * @param {String} txHashAndAccountId transaction hash + accountId,
     * separated by ':'
     * @returns {Object} returns transaction object
     */
    // TODO: Update accountID references to be signerID (more explicit)
    async routeEthGetTransactionByHash([txHashAndAccountId]) {
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
        blockHash = utils.hexToBase58(blockHash);
        txIndex = utils.hexToDec(txIndex);

        assert(blockHash, 'Must pass in block hash as first argument');
        assert(txIndex !== undefined && typeof txIndex === 'number', 'Must pass in tx index as second argument');

        const block = await this._getBlock(blockHash, true);
        const tx = block.transactions[txIndex];
        return tx || null;
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
        txIndex = utils.hexToDec(txIndex);

        assert(txIndex !== undefined,
            'Must pass in tx index as second argument');
        assert(blockHeight,
            'Must pass in block height as first argument');

        blockHeight = await utils.convertBlockHeight(blockHeight, this.nearProvider);

        const block = await this._getBlock(blockHeight, true);
        const tx = block.transactions[txIndex];

        return tx || null;
    }

    /**
     * Returns the receipt of a transaction by transaction hash
     * @param {String} fullTxHash transaction hash (base58hash:accountId)
     * @returns {Object} returns transaction receipt object or null
     */
    async routeEthGetTransactionReceipt([fullTxHash]) {
        assert(fullTxHash, 'Must pass in transaction hash');
        const { txHash, accountId } = utils.getTxHashAndAccountId(fullTxHash);

        const fullTx = await this.nearProvider.txStatus(utils.base58ToUint8(txHash), accountId);

        const [block, nearBlock] = await this._getBlock(fullTx.transaction_outcome.block_hash, false, true);
        const txIndex = block.transactions.indexOf(fullTxHash);

        return nearToEth.transactionReceiptObj(nearBlock, fullTx, txIndex, accountId);
    }

    /**
     * Temporarily hardcode to provide something for eth_getLogs
     * Returns the logs from set of blocks.
     * @param TODO
     * @returns {Object} returns TODO
     */
    async routeEthGetLogs([logsParams]) {
        const { address, fromBlock, toBlock, topics } = logsParams;

        // TODO: implement fetching logs fromBlock..toBlock with filtering for specific address.
        const i = 0;
        return [{
            logIndex: utils.include0x(i.toString(16)),
            blockNumber: 19,
            blockHash: 'fakeblockhash',
            transactionHash: 'hello',
            transactionIndex: '0x0',
            address: 'hardcoded',
            data: '0xhardcoded',
            topics: [],
        }];
    }

    /**
     * Returns the number of transactions SENT from an address
     * @param {String} address 20-byte address
     * @returns {Quantity} Integer of the number of transactions sent
     * from this address
     */
    async routeEthGetTransactionCount([address]) {
        let result = await this._viewEvmContract(
            consts.GET_NONCE_METHOD_NAME,
            utils.deserializeHex(address)
        );
        return `0x${Buffer.from(result).toString('hex')}`;
    }

    /**
     * Creates new message call transaction or a contract creation, if
     * the data field contains code, pass it through
     * web3.eth.sendTransaction
     *
     * NB: Internally, eth_sendTransaction generates a transaction receipt
     * object, so this method is intrinsically connected to
     * eth_getTransactionReceipt. If the latter has errors, this method will
     * error.
     * @param    {Object} txObj transaction object
     * @property {String} txObj.to EVM destination address
     * @property {String} txObj.value amount of yoctoNEAR to attach
     * @property {String} txObj.gas amount of gas to attach
     * @property {String} txObj.data the encoded call data
     * @returns  {String} The resulting txid
     */
    // TODO: Account for passed in gas
    async routeEthSendTransaction([txObj]) {
        const { from, to, value, data } = txObj;

        const accountId = await this._addressToAccountId(from);
        assert(accountId !== null && accountId !== undefined, `Unknown address ${from}. Check your key store to make sure you have it available.`);
        const account = this._getAccount(accountId);

        let outcome;
        let val = value ? utils.hexToBN(value) : new BN(0);

        if (data === undefined) {
            // send funds
            if (to !== consts.ZERO_ADDRESS && to === from) {
                // Add near to corresponding evm account
                outcome = await account.functionCall(
                    this.evm_contract,
                    consts.DEPOSIT_METHOD_NAME,
                    utils.deserializeHex(from),
                    consts.GAS_AMOUNT,
                    val
                );
            } else  {
                // Simple Transfer b/w EVM accounts
                let zeroVal = new BN(0);
                outcome = await utils.rawFunctionCall(
                    account,
                    this.evm_contract,
                    consts.TRANSFER_METHOD_NAME,
                    utils.encodeTransferArgs(to, value),
                    consts.GAS_AMOUNT,
                    zeroVal
                );
            }
        } else if (to === undefined) {
            // Contract deployment
            try {
                outcome = await utils.rawFunctionCall(
                    account,
                    this.evm_contract,
                    consts.DEPLOY_CODE_METHOD_NAME,
                    utils.deserializeHex(data),
                    consts.GAS_AMOUNT,
                    val
                );
            } catch (error) {
                console.log("ERROR: ", error);
                throw error;
            }
        } else {
            // Function Call
            try {
                outcome = await utils.rawFunctionCall(
                    account,
                    this.evm_contract,
                    consts.CALL_FUNCTION_METHOD_NAME,
                    utils.encodeCallArgs(to, data),
                    consts.GAS_AMOUNT,
                    val
                );
            } catch (error) {
                if (error.type === 'FunctionCallError') {
                    if (error.kind.EvmError.Revert) {
                        let message = utils.hexToString(error.kind.EvmError.Revert);
                        throw Error(`revert ${message}`);
                    }
                }
                throw Error(`Unknown error: ${JSON.stringify(error)}`);
            }
        }
        return `${outcome.transaction_outcome.id}:${accountId}`;
    }

    /**
     * Creates transaction to send send funds from evm account
     * to a near account
     * @param    {Object} txObj transaction object
     * @property {String} txObj.to near destination accountId
     * @property {String} txObj.value amount of yoctoNEAR to attach
     * @property {String} txObj.gas amount of gas to attach
     * @returns  {String} The resulting txid
     */
    async routeNearRetrieveNear([txObj]) {
        const { from, to, value } = txObj;
        const accountId = await this._addressToAccountId(from);
        assert(accountId !== null && accountId !== undefined, `Unknown address ${from}. Check your key store to make sure you have it available.`);
        const account = this._getAccount(accountId);
        let outcome = await utils.rawFunctionCall(
            account,
            this.evm_contract,
            consts.WITHDRAW_METHOD_NAME,
            utils.encodeWithdrawArgs(to, value),
            consts.GAS_AMOUNT,
            new BN(0)
        );
        return `${outcome.transaction_outcome.id}:${this.accountId}`;
    }

    /**
     * Creates transaction to send send funds from evm account
     * to the evmAccount of a corresponding near accountId
     * @param    {Object} txObj transaction object
     * @property {String} txObj.to near destination accountId
     * @property {String} txObj.value amount of yoctoNEAR to attach
     * @property {String} txObj.gas amount of gas to attach
     * @returns  {String} The resulting txid
     */
    async routeNearTransferNear([txObj]) {
        const { to, value } = txObj;
        let outcome = await this.account.functionCall(
            this.evm_contract,
            consts.TRANSFER_METHOD_NAME,
            utils.encodeTransferArgs(to, value),
            consts.GAS_AMOUNT,
            consts.zeroVal
        );
        return `${outcome.transaction_outcome.id}:${this.accountId}`;
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
     * transaction on the block chain.
     * @param {Object} txCallObj transaction call object.
     * @property {String} to the address the tx is directed to.
     * @property {String} from (optional) the address the tx is sent from.
     * @property {Quantity} value (optional) integer of the value sent
     * with this tx.
     * @property {String} data (optional) hash of the method signature
     * and encoded parameters.
     * @returns {String} the return value of the executed contract.
     * @throws {Error(String)} error when contract exection fails.
     */
    async routeEthCall([txCallObj]) {
        const { to, from, value, data } = txCallObj;
        let result;
        try {
            result = await this._viewEvmContract(
                consts.VIEW_CALL_FUNCTION_METHOD_NAME,
                utils.encodeViewCallArgs(from, to, value ? value : '0x0', data),
            );
        } catch (error) {
            // TODO: add more logic here for various types of errors.
            const errorObj = JSON.parse(error.message.slice(error.message.indexOf('\n') + 1));
            if (errorObj.error.includes("wasm execution failed with error:")) {
                const REVERT_PREFIX = 'FunctionCallError(EvmError(Revert("';
                if (errorObj.error.includes(REVERT_PREFIX)) {
                    const message = errorObj.error.slice(errorObj.error.indexOf(REVERT_PREFIX) + REVERT_PREFIX.length, errorObj.error.length - 4);
                    throw new Error(`revert` + (message ? (' ' + utils.hexToString(message)) : ''));
                }
            }
            throw error;
        }

        const output = Buffer.from(result);
        return `0x${output.toString('hex')}`;
    }

    async signTypedData(params) {
        const [address, typedDataToSign] = params;

        const accountId = await this._addressToAccountId(address);
        assert(accountId !== null && accountId !== undefined, `Unknown address ${address}. Check your key store to make sure you have it available.`);

        // TODO: add a bunch of checks that it's a valid TypedData data.

        const message = sigUtil.TypedDataUtils.sign(typedDataToSign);
        const sig = await this.connection.signer.signMessage(message, accountId, this.networkId);
        return `0x${new Buffer(sig.signature).toString('hex')}`;
    }
}

module.exports = { NearProvider, nearAPI, nearWeb3Extensions, utils };
