const bs58 = require('bs58');
const nearlib = require("nearlib");
const BN = require("bn.js");

const NEAR_NET_VERSION = "99";

const utils = require('./utils');

const nearToEth = require('./near_to_eth_objects');

// DELETE LATER
const TEST_NEAR_ACCOUNT = '0xd148eC3d91AB223AD19051CE651fab2Cf0bE6410';
const TEST_ACCOUNT_TWO = '0xd148eC3d91AB223AD19051CE651fab2Cf0bE6410';

class NearProvider {
    constructor(url) {
        const networkId = 'default';
        this.evm_contract = 'evm';
        this.url = url;
        this.nearProvider = new nearlib.providers.JsonRpcProvider(url);

        const keyPairString = 'ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw';
        const keyPair = nearlib.utils.KeyPair.fromString(keyPairString)
        this.keyStore = new nearlib.keyStores.InMemoryKeyStore();
        this.keyStore.setKey(networkId, TEST_NEAR_ACCOUNT, keyPair);

        this.signer = new nearlib.InMemorySigner(this.keyStore);

        this.connection = new nearlib.Connection(networkId, this.nearProvider, this.signer);
        this.account = new nearlib.Account(this.connection, TEST_NEAR_ACCOUNT);
    }

    async _createNewAccount(accountId) {
        // create keypair
        const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
        await this.keyStore.setKey(this.networkId, accountId, keyPair)
        this.accounts[accountId] = new nearlib.Account(this.connection, accountId);
        this.signer = new nearlib.InMemorySigner(this.keyStore);
        this.connection = new nearlib.Connection('default', this.nearProvider, this.signer);
    }

    async _callEvmContract(method, params) {
        const paramsType = typeof params;
        const stringifyParams = paramsType === 'string'
            ? params
            : JSON.stringify(params)

        try {
            const result = await this.nearProvider.query(
                `call/${this.evm_contract}/${method}}`,
                stringifyParams
            );
            return result;
        } catch (e) {
            return e;
        }
    }

    async _ethAddressToNearAddress(ethAddress) {
        const method = 'utils.evm_account_to_internal_address';
        try {
            const nearAddress = await this._callEvmContract(method, ethAddress);
            return nearAddress;
        } catch (e) {
            return e;
        }
    }

    // Maps ethereum RPC into NEAR RPC requests and remaps back the responses.
    async ethNearRpc(method, params) {
        switch (method) {

            /**
             * Returns the current network id
             * @returns {String}
             */
            case "net_version": {
                return NEAR_NET_VERSION;
            }

            /**
             * Returns true if client is actively listening for network
             * connections
             * @returns {boolean}
             */
            case "net_listening": {
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
            case "eth_syncing": {
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
             * Returns the current price per gas in wei
             * @returns {Quantity} integer of the current gas price in wei as hex
             */
            case "eth_gasPrice": {
                // TODO: query gas price.
                // Is this ETH gas price or NEAR gas price? TBD
                // https://docs.nearprotocol.com/docs/roles/integrator/faq#fees
                return '0x100';
            }

            /**
             * Returns a list of addresses owned by client/accounts the node
             * controls
             * @returns {Data[]} array of 20 byte addresses
             */
            case "eth_accounts": {
                // TODO: Near accounts have human-readable names and do not match the ETH address format. web3 will not allow non-valid Ethereum addresses and errors.

                const networkId = this.connection.networkId;
                const accounts = await this.keyStore.getAccounts(networkId);
                console.log(accounts)

                // call evm contract
                // const evmMethod = 'utils.near_account_id_to_evm_address';

                // const promises = [];

                // const nearAccountIdToEvmAddress = (accountId) => {
                //     return new Promise((resolve, reject) => {
                //         this.nearProvider.query(
                //             `call/${this.evm_contract}/${evmMethod}}`,
                //             accountId
                //         )
                //             .then((id) => resolve(id))
                //             .catch((err) => reject(err));
                //     });
                // }

                // const promiseArray = accounts.map((accountId) => {
                //     promises.push(nearAccountIdToEvmAddress(accountId));
                // });

                // Promise.all(promiseArray)
                //     .then((res) => {
                //         console.log({res});
                //         return res;
                //     })
                //     .catch((err) => {
                //         return new Error(err);
                //     });

                // console.log({ remappedAccounts})
                // return remappedAccounts;
                return ['0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368'];
            }

            /**
             * Returns the number of the most recent block
             * @returns {Quantity} integer of the current block number the
             * client is on
             */
            case "eth_blockNumber": {
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
            case "eth_getBalance": {
                console.log({params})
                const address = params[0];
                const block = params[1];

                // I think we need to do an in between check
                try {
                    const state = await this.nearProvider.query(`account/bobblehead`, '');
                    // Are transactions in order?
                    console.log({state})
                    const block = await this.nearProvider.block(state.block_height)
                    console.log({block})
                    // TODO: Convert NEAR amount to wei
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
            case "eth_getStorageAt": {
                const address = params[0];
                const position = params[1];
                const block = params[2];

                return "0x";
            }

            /**
             * Gets the code at a specific address
             * @param {String} address 20-byte address to get the code from
             * @param {Quantity} block (optional)
             */
            case "eth_getCode": {
                // TODO: I don't think this contract_address bit is correct
                try {
                    let result = await this.account.viewFunction("evm", "code_at", { contract_address: params[0].slice(2) });
                    // console.warn(result);
                    return "0x" + result;
                } catch (e) {
                    return e;
                }
            }

            /**
             * Returns block
             * web3.eth.getBlock accepts either a hash or a number.
             * Block hash params are handled here
             * @param {String} blockHash block hash
             * @param {Boolean} returnTxObjects (optional) default: false. if
             * true returns the full transaction objects, else false.
             * @returns {Object} returns block object
             */
            case "eth_getBlockByHash": {
                let blockHash = params[0];
                const returnTxObjects = params[1];

                // TODO: blockHash being sent is an ETH block hash. How does this equate with NEAR blocks? Is the blockHash actually the base58 equivalent of a NEAR block? Or does the user actually want the ETH block for this ETH block hash? If following along with eth_getBlockByNumber, then the blockHash should reference a NEAR block, not an ETH block, and the blockHash should translate directly to a NEAR block hash
                console.log('by hash')
                blockHash = utils.hexToBase58(blockHash);

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
            case "eth_getBlockByNumber": {
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
            case "eth_getBlockTransactionCountByHash": {
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
            * @param {String} blockHash 32-byte block hash
            * @returns {Quantity} Integer of the number of txs in this block
            */
            // TODO: Handle other enum strings
            case "eth_getBlockTransactionCountByNumber": {
                console.log('number')
                let blockHeight = params[0];

                if (blockHeight === 'latest') {
                    const status = await this.nearProvider.status();
                    blockHeight = status.sync_info.latest_block_height;
                } else {
                    blockHeight = utils.hexToDec(blockHeight);
                }

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
             * @param {String} txHash transaction hash
             * @returns {Object} returns transaction object
             */
            case "eth_getTransactionByHash": {
                const txHash = utils.hexToBase58(params[0]);

                const block = await this.nearProvider.block(1221180);
                // let outcome = await this.provider.txStatus(Buffer.from(bs58.decode(params[0])), this.account.accountId);

                // TODO: this is hardcoded ATM.
                return nearToEth.transactionObj(block.chunks[0], block.header.hash);
            }

            case "eth_getTransactionByBlockHashAndIndex": {

            }

            case "eth_getTransactionByBlockNumberAndIndex": {

            }

            case "eth_getTransactionReceipt": {
                let status = await this.nearProvider.status();
                let outcome = await this.nearProvider.txStatus(Buffer.from(bs58.decode(params[0])), this.account.accountId);
                const responseHash = utils.base64ToString(outcome.status.SuccessValue);
                // TODO: compute proper tx status: accumulate logs and gas.
                const result = {
                    transactionHash: params[0],
                    transactionIndex: '0x1',
                    blockNumber: '0x' + status["sync_info"]["latest_block_height"].toString(16),
                    blockHash: utils.base58ToHex(status["sync_info"]["latest_block_hash"]),
                    contractAddress: '0x' + responseHash.slice(1, responseHash.length - 1),
                    gasUsed: utils.decToHex(outcome.transaction.outcome.gas_burnt),
                    logs: outcome.transaction.outcome.logs,
                    status: '0x1',
                };
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
            case "eth_getTransactionCount": {
                const address = params[0];
                const block = params[1];
                // TODO: transaction count.

                console.log({address, block})
                // get other thing isntead
                try {
                    // const query = await this.nearProvider.query('account/evm', '')
                    const account = new nearlib.Account(this.connection, 'liau')
                    const details = await account.state();
                    console.log(details);
                    return "0x0";
                } catch (e) {
                    console.log({e})
                    return '0x0';
                }
            }

            /**
             * web3.eth.sendTransaction and web3.eth.sendSignedTransaction
             */
            case "eth_sendTransaction": {
                if (params[0].to === undefined) {
                    // If contract deployment.
                    let outcome = await this.account.functionCall(
                        this.evm_contract,
                        "deploy_code",
                        { "bytecode": params[0].data.slice(2) },
                        new BN(params[0].gas.slice(2), 16),
                        "100000");
                    return outcome.transaction.id;
                } else {
                    let outcome = await this.account.functionCall(
                        this.evm_contract,
                        "run_command",
                        { contract_address: params[0].to.slice(2), encoded_input: params[0].data.slice(2) },
                        "10000000", 0
                    )
                    return outcome.transaction.id;
                }
            }

            /**
             * web3.eth.sign and web3.eth.signTransaction
             */
            case "eth_sign": {

            }

            case "eth_call": {
                let result = await this.account.viewFunction("evm", "view_call", { contract_address: "de5f4b90790d48e0c00348eb55c6d763a47a9443", encoded_input: params[0].data.slice(2) });
                return "0x" + result;
            }

            case "eth_estimateGas": {
                return "0x00";
            }

            case "eth_getPastLogs": {

            }
        }
        throw new Error(`NearProvider: Unknown method: ${method} with params ${params}`);
    }

    sendAsync(payload, cb) {
        this.ethNearRpc(payload["method"], payload["params"]).then((result) => {
            cb(null, {
                id: payload["id"],
                jsonrpc: "2.0",
                result
            });
        }, (err) => {
            console.error(err);
            new Error(`NearProvider: ${err}`);
        });
    }

    send(payload, cb) {
        this.ethNearRpc(payload["method"], payload["params"]).then((result) => {
            cb(null, {
                id: payload["id"],
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
        console.warn("getAddress");
        console.warn(idx);
    }

    getAddresses() {
        // TODO: return proper addresses.
        return [];
    }

    supportsSubscriptions() {
        return false;
    }
}

module.exports = NearProvider;
