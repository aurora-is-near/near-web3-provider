const BN = require('bn.js');
const assert = require('bsert');
const web3Utils = require('web3-utils');
const nearlib = require('near-api-js');

const NEAR_NET_VERSION = '99';
const NEAR_NET_VERSION_TEST = '98';

const utils = require('./utils');
const nearToEth = require('./near_to_eth_objects');
const nearWeb3Extensions = require('./near_web3_extensions');
const { Account } = require('near-api-js');

const GAS_AMOUNT = new BN('300000000000000');
const ZERO_ADDRESS = `0x${'00'.repeat(20)}`;

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
        this.accounts = new Map();
        this.accounts.set(this.accountId, this.account);
    }

    async _createNewAccount(accountId) {
        // Create keypair.
        const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
        await this.keyStore.setKey(this.networkId, accountId, keyPair);
        this.accounts[accountId] = new nearlib.Account(this.connection, accountId);
    }

    async _viewEvmContract(method, methodArgs) {
        const result = await this.account.viewFunction(
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

        /**-----------UNSUPPORTED METHODS------------**/
        case 'eth_sign': {
            return new Error(this.unsupportedMethodErrorMsg(method));
        }

        // case 'eth_getLogs': {
        //     return new Error(this.unsupportedMethodErrorMsg(method));
        // }

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
            throw new Error(this.unsupportedMethodErrorMsg(method));
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
        const result = await this.nearProvider.block(latest_block_hash);

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
        const address = utils.remove0x(params[0]);
        const balance = await this._viewEvmContract(
            'balance_of_evm_address',
            { address }
        );
        return '0x' + new BN(balance, 10).toString(16);
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
        address = utils.remove0x(address);

        let result = await this._viewEvmContract(
            'get_storage_at',
            { address, key }
        );
        return `0x${result}`;
    }

    /**
     * Gets the code at a specific address
     * @param {String} address 20-byte address to get the code from
     */
    async routeEthGetCode([address]) {
        address = utils.remove0x(address);
        let result = await this._viewEvmContract(
            'get_code',
            { address });
        return '0x' + result;
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
     * Returns the logs of a transaction
     * @param {String} fullTxHash transaction hash (base58hash:accountId)
     * @returns {Object} returns TODO
     */
    async routeEthGetLogs([fromBlock]) {
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
        address = utils.remove0x(address);

        let result = await this._viewEvmContract(
            'nonce_of_evm_address',
            { address }
        );
        return `0x${new BN(result, 10).toString(16)}`;
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
            if (to !== ZERO_ADDRESS && to === from) {
                // Add near to corresponding evm account
                outcome = await account.functionCall(
                    this.evm_contract,
                    'add_near',
                    {},
                    GAS_AMOUNT,
                    val
                );
            } else  {
                // Simple Transfer b/w EVM accounts
                let zeroVal = new BN(0);
                outcome = await account.functionCall(
                    this.evm_contract,
                    'move_funds_to_evm_address',
                    { 'address': utils.remove0x(to), 'amount': val.toString() },
                    GAS_AMOUNT,
                    zeroVal
                );
            }
        } else if (to === undefined) {
            // Contract deployment
            outcome = await account.functionCall(
                this.evm_contract,
                'deploy_code',
                { bytecode: utils.remove0x(data) },
                GAS_AMOUNT,
                val
            );
        } else {
            // Function Call
            try {
                outcome = await account.functionCall(
                    this.evm_contract,
                    'call_contract',
                    { contract_address: utils.remove0x(to), encoded_input: utils.remove0x(data) },
                    GAS_AMOUNT.toString(),
                    val
                );
            } catch (error) {
                console.log('aloha web3 error0', error);
                let panic_msg = utils.hexToString(error.panic_msg);
                // In some cases message is doubly encoded.
                if (utils.isHex(panic_msg)) {
                    console.log('aloha web3 error1');
                    panic_msg = utils.hexToString(panic_msg);
                    console.log('aloha web3 error1', panic_msg);
                }
                throw Error(`revert ${panic_msg}`);
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
        const { to, value } = txObj;
        let val = value ? utils.hexToBN(value) : new BN(0);
        let outcome = await this.account.functionCall(
            this.evm_contract,
            'retrieve_near',
            { 'recipient': to, 'amount': val.toString() },
            GAS_AMOUNT,
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
        let val = value ? utils.hexToBN(value) : new BN(0);
        let outcome = await this.account.functionCall(
            this.evm_contract,
            'move_funds_to_near_account',
            { 'address': to, 'amount': val.toString() },
            GAS_AMOUNT,
            new BN(0)
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

        // TODO: add more logic here for various types of errors. heheh
        if (result.toLowerCase().includes('reverted')) {
            const [errorType, message] = result.split(' ');
            throw new Error(`${errorType.toLowerCase()} ${utils.hexToString(message)}`);
        }
        return '0x' + result;
    }
}

module.exports = { NearProvider, nearlib, nearWeb3Extensions, utils };
