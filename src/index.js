'const bs58 = require('bs58');
const nearlib = require('nearlib');
const BN = require('bn.js');
const assert = require('bsert');

const NEAR_NET_VERSION = '99';

const utils = require('./utils');
const nearToEth = require('./near_to_eth_objects');

class NearProvider {
    constructor(url, keyStore, accountId) {
        const networkId = process.env.NODE_ENV || 'default';
        this.evm_contract = 'evm';
        this.url = url;
        this.nearProvider = new nearlib.providers.JsonRpcProvider(url);

        this.keyStore = keyStore;
        this.signer = new nearlib.InMemorySigner(this.keyStore);

        this.connection = new nearlib.Connection(networkId, this.nearProvider, this.signer);
        this.accountId = accountId;
        this.account = new nearlib.Account(this.connection, accountId);
    }

    async _createNewAccount(accountId) {
        // create keypair
        const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
        await this.keyStore.setKey(this.networkId, accountId, keyPair);
        this.accounts[accountId] = new nearlib.Account(this.connection, accountId);
        this.signer = new nearlib.InMemorySigner(this.keyStore);
        this.connection = new nearlib.Connection('default', this.nearProvider, this.signer);
    }

    async _callEvmContract(method, methodArgs) {
        // TODO: clarify methodArgs passed in should be { argName: arg }
        // Step 3 in https://docs.nearprotocol.com/docs/roles/developer/examples/nearlib/guides#levels-of-abstraction
        methodArgs = bs58.encode(Buffer.from(JSON.stringify(methodArgs)));

        try {
            const result = await this.nearProvider.query(
                `call/${this.evm_contract}/${method}`,
                methodArgs
                // 'call/evm/balance_of_near_account',
                // "6x8V37bGexiqvZNMu397P2"
            );
            return result;
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
            return NEAR_NET_VERSION;
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
            return this.routeEthSendTransactionh(params);
        }

        case 'eth_sendRawTransaction': {
            return this.routeEthSendRawTransactionh(params);
        }

        case 'eth_sign': {
            return this.routeEthSign(params);
        }

        case 'eth_call': {
            return this.routeEthCall(params);
        }

        case 'eth_estimateGas': {
            return this.routeEthEstimateGas(params);
        }

        case 'eth_getPastLogs': {
            return this.routeEthGetPastLogss(params);
        }

        /**-----------UNSUPPORTED METHODS------------**/
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
            // TODO: Syncing always returns false even though values are updating
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
     * yoctoNEAR as Decimal String
     */
    async routeEthGasPrice() {
        try {
            const { sync_info: { latest_block_hash } } = await this.nearProvider.status();
            const result = await this.nearProvider.block(latest_block_hash);
            return result.header.gas_price;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns a list of addresses owned by client/accounts the node
     * controls
     * @returns {String[]} array of 0x-prefixed 20 byte addresses
     */
    async routeEthAccounts() {
        // TODO: Near accounts have human-readable names and do not match the ETH address format. web3 will not allow non-valid Ethereum addresses and errors.
        const networkId = this.connection.networkId;
        const accounts = await this.keyStore.getAccounts(networkId);

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
     * @param {Quantity|Tag} block Optional. Integer block
     * number, or the string "latest", "earliest", or "pending".
     * Default is "latest"
     * @returns {Quantity} integer of the current balance in wei
     */
    async routeEthGetBalance(params) {
        console.log({params});
        const address = params[0];
        // const block = params[1];
        // TODO: Convert hex address to NEAR account ID
        // I think we need to do an in between check
        try {
            // const state = await this.nearProvider.query(`account/bobblehead`, '');
            // // Are transactions in order?
            // console.log({state})
            // const block = await this.nearProvider.block(state.block_height)
            // console.log({block})
            const balance = await this._callEvmContract('balance_of_near_account', { address });
            console.log({balance});
            return utils.decToHex(10000000000);
        } catch (e) {
            return e;
        }
    }
    /**
     * Returns the value from a storage position at a given address.
     * @param {String} address 20-byte address of the storage
     * @param {Quantity} position The index position of the storage
     * @param {Quantity} block (optional) Block
     * @returns {String} The value at this storage position
     */
    async routeEthGetStorageAt(/*params*/) {
        // const address = params[0];
        // const position = params[1];
        // const block = params[2];

        // From near-evm contract:
        //// for Eth call of similar name
        // pub fn get_storage_at(& self, address: String, key: String) -> String {
        return '0x';
    }

    /**
     * Gets the code at a specific address
     * @param {String} address 20-byte address to get the code from
     * @param {Quantity} block (optional)
     */
    async routeEthGetCode(params) {
        const address = utils.remove0x(params[0]);

        try {
            let result = await this._callEvmContract(
                'code_at',
                { contract_address: address });
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
    async routeEthGetBlockByHash(params) {
        console.log('get block by hash');

        const blockHash = utils.hexToBase58(params[0]);
        const returnTxObjects = params[1];

        try {
            const block = await this.nearProvider.block(blockHash);
            return nearToEth.blockObj(block, returnTxObjects);
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
    // TODO: Handle other enum strings
    async routeEthGetBlockByNumber(params) {
        let blockHeight = params[0];
        const returnTxObjects = params[1];

        try {
            if (blockHeight === 'latest') {
                const status = await this.nearProvider.status();
                blockHeight = status.sync_info.latest_block_height;
            } else {
                blockHeight = utils.hexToDec(blockHeight);
            }

            const block = await this.nearProvider.block(blockHeight);
            return nearToEth.blockObj(block, returnTxObjects);
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
    async routeEthGetBlockTransactionCountByHash(params) {
        let blockHash = params[0];
        blockHash = utils.hexToBase58(blockHash);

        try {
            const block = await this.nearProvider.block(blockHash);
            const transactionCount = block.header.chunks_included;
            return utils.decToHex(transactionCount);
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
    // TODO: Handle other enum strings
    async routeEthGetBlockTransactionCountByNumber(params) {
        console.log('number');
        let blockHeight = params[0];

        if (blockHeight === 'latest') {
            const status = await this.nearProvider.status();
            blockHeight = status.sync_info.latest_block_height;
        } else {
            blockHeight = utils.hexToDec(blockHeight);
        }

        // TODO: Are chunks the same as transactions?
        try {
            const block = await this.nearProvider.block(blockHeight);
            const transactionCount = block.header.chunks_included;

            return utils.decToHex(transactionCount);
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
    async routeEthGetTransactionByHash(params) {
        let { txHash, accountId } = utils.getTxHashAndAccountId(params[0]);

        // NB: provider.txStatus requires txHash to be a Uint8Array of
        // the base58 tx hash. Since txHash is hex, it is converted to
        // base58, and then turned into a Buffer
        txHash = new Uint8Array(bs58.decode(utils.hexToBase58(txHash)));

        const tx = await this.nearProvider.txStatus(txHash, accountId);

        // const blockHash = tx.transaction_outcome.block_hash;
        // const block = await this.nearProvider.block(blockHash);

        console.log({tx});

        return nearToEth.transactionObj(tx);
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
    async routeEthGetTransactionByBlockHashAndIndex(params) {
        const blockHash = utils.hexToBase58(params[0]);
        const txIndex = utils.hexToDec(params[1]);

        assert(blockHash, 'Must pass in block hash as first argument');
        assert(txIndex !== undefined && typeof txIndex === 'number', 'Must pass in tx index as second argument');

        try {
            const block = await this.nearProvider.block(blockHash);
            const tx = nearToEth.transactionObj(block.chunks[txIndex], block.header.hash);

            return tx;
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
    async routeEthGetTransactionByBlockNumberAndIndex(params) {
        let blockHeight = params[0];
        const txIndex = utils.hexToDec(params[1]);

        assert(blockHeight, 'Must pass in block height as first argument');
        assert(txIndex !== undefined && typeof txIndex === 'number', 'Must pass in tx index as second argument');

        if (blockHeight === 'latest') {
            const status = await this.nearProvider.status();
            blockHeight = status.sync_info.latest_block_height;
        } else {
            blockHeight = utils.hexToDec(blockHeight);
        }

        // TODO: Are chunks the same as transactions?
        try {
            const block = await this.nearProvider.block(blockHeight);
            const tx = nearToEth.transactionObj(block.chunks[txIndex], block.header.hash);

            return tx;
        } catch (e) {
            return e;
        }
    }

    /**
     * Returns the receipt of a transaction by transaction hash
     * @param {String} txHash transaction hash
     * @returns {Object} returns transaction receipt object or null
     */
    async routeEthGetTransactionReceipt(params) {
        // const txHash = utils.hexToBase58(params[0]);
        let status = await this.nearProvider.status();
        let outcome = await this.nearProvider.txStatus(Buffer.from(bs58.decode(params[0])), this.accountId);

        // TODO: compute proper tx status: accumulate logs and gas.
        const result = nearToEth.transactionReceiptObj(status, outcome);
        return result;
    }

    /**
     * Returns the number of transactions SENT from an address
     * @param {String} address 20-byte address
     * @param {Quantity|Tag} block (optional) block number, or the
     * string "latest", "earliest", or "pending"
     * @returns {Quantity} Integer of the number of transactions sent
     * from this address
     */
    async routeEthGetTransactionCount(params) {
        const address = params[0];
        const block = params[1];
        // TODO: transaction count.

        console.log({address, block});
        // get other thing isntead
        try {
            // const query = await this.nearProvider.query('account/evm', '')
            const account = new nearlib.Account(this.connection, this.accountId);
            const details = await account.state();
            console.log(details);
            return '0x0';
        } catch (e) {
            console.log({e});
            return '0x0';
        }
    }

    /**
     * Creates new message call transaction or a contract creation, if
     * the data field contains code
     * web3.eth.sendTransaction
     *
     */
    async routeEthSendTransaction(params) {
        if (params[0].to === undefined) {
            // If contract deployment.
            let outcome = await this.account.functionCall(
                this.evm_contract,
                'deploy_code',
                { 'bytecode': params[0].data.slice(2) },
                new BN(params[0].gas.slice(2), 16),
                '100000');
            return outcome.transaction.id;
        } else {
            let outcome = await this.account.functionCall(
                this.evm_contract,
                'run_command',
                { contract_address: params[0].to.slice(2), encoded_input: params[0].data.slice(2) },
                '10000000', 0
            );
            return outcome.transaction.id;
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
    async routeEthSendRawTransaction() {
        // const txData = params[0];
        // TODO
        return '0x';
    }

    /**
     * web3.eth.sign and web3.eth.signTransaction
     */
    // https://nomicon.io/Runtime/Scenarios/FinancialTransaction.html
    async routeEthSign() {
        // TODO
    }

    /**
     * Executes a new message call immediately without creating a
     * transaction on the block chain
     * @param {Object} txCallObj transaction call object
     * @property {String} to the address the tx is directed to
     * @property {String} from (optional) the address the tx is sent
     * from
     * @property {Quantity} gas (optional) integer of the gas provided
     * for the tx execution. `eth_call` consumes zero gas, but this
     * parameter may be needed by some executions
     * @property {Quantity} value (optional) integer of the value sent
     * with this tx
     * @property {String} data (optional) hash of the method signature
     * and encoded parameters
     * @param {Quantity|Tag} blockHeight integer block number or the
     * string 'latest', 'earliest', or 'pending'
     * @returns {String} the return value of the executed contract
     */
    async routeEthCall(params) {
        const {to, value, gas, data} = params[0];
        let result = await this.account.viewFunction(
          'evm',
          'view_call',
          {
            contract_address: utils.remove0x(to),
            encoded_input: utils.remove0x(data)
          });
        return '0x' + result;
    }

    // TODO
    async routeEthEstimateGas() {
        return '0x00';
    }

    // TODO
    async routeEthGetPastLogs() {
        return '0x00';
    }
}

module.exports = NearProvider;
