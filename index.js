const bs58 = require('bs58');
const nearlib = require("nearlib");
const BN = require("bn.js");

const NEAR_NET_VERSION = 99;

function decToHex(value) {
    return '0x' + value.toString(16);
}

function hexToDec(value) {
    return parseInt(value.slice(2), 16);
}

function base58ToHex(value) {
    return '0x' + Buffer.from(bs58.decode(value)).toString('hex');
}

function base64ToHex(value) {
    return '0x' + Buffer.from(value, 'base64').toString('hex');
}

function base64ToString(value) {
    return Buffer.from(value, 'base64').toString();
}

class NearProvider {
    constructor(url) {
        this.evm_contract = "evm";
        this.url = url;
        this.nearProvider = new nearlib.providers.JsonRpcProvider(url);
        const keyStore = new nearlib.keyStores.InMemoryKeyStore();
        keyStore.setKey("default", "test.near", nearlib.utils.KeyPair.fromString('ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw')).then(() => {
            this.signer = new nearlib.InMemorySigner(keyStore);
            const connection = new nearlib.Connection("default", this.nearProvider, this.signer);
            this.account = new nearlib.Account(connection, "test.near");
        });
    }

    // Maps ethereum RPC into NEAR RPC requests and remaps back the responses.
    async ethNearRpc(method, params) {
        switch (method) {
            /**
             * Returns true if client is actively listening for network
             * connections
             * @returns {boolean}
             */
            case "net_listening": {
                const status = await this.nearProvider.status();
                if (status) {
                    return true;
                }
                return false;
            }
            case "net_version": {
                return NEAR_NET_VERSION;
            }
            case "eth_blockNumber": {
                const status = await this.nearProvider.status();
                return '0x' + status["sync_info"]["latest_block_height"].toString(16);
            }
            case "eth_gasPrice": {
                // TODO: query gas price.
                return '0x100';
            }
            case "eth_accounts": {
                return ['0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368'];
            }
            case "eth_getBlockByNumber": {
                let blockHeight = params[0];
                if (blockHeight === "latest") {
                    const status = await this.nearProvider.status();
                    blockHeight = status["sync_info"]["latest_block_height"];
                } else {
                    blockHeight = hexToDec(blockHeight);
                }
                const block = await this.nearProvider.block(blockHeight);
                // console.warn(JSON.stringify(block.header));
                return {
                    number: '0x' + block.header.height.toString(16),
                    hash: base58ToHex(block.header.hash),
                    parentHash: base58ToHex(block.header.prev_hash),
                    nonce: null,
                    transactionsRoot: base58ToHex(block.header.chunk_tx_root),
                    // TODO: gas limit
                    gasLimit: "0xffffffffff",
                };
            }
            case "eth_getCode": {
                let result = await this.account.viewFunction("evm", "get_code", { contract_address: params[0].slice(2) });
                // console.warn(result);
                return "0x" + result;
            }
            case "eth_getTransactionCount": {
                // TODO: transaction count.
                return "0x0";
            }
            case "eth_getBalance": {
                // TODO: balance.
                return "0x10000000000000000";
            }
            case "eth_getStorageAt": {
                return "0x";
            }
            case "eth_estimateGas": {
                return "0x00";
            }
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
                return;
            }
            case "eth_getTransactionByHash": {
                let status = await this.nearProvider.status();
                // let outcome = await this.provider.txStatus(Buffer.from(bs58.decode(params[0])), this.account.accountId);
                // TODO: this is hardcoded ATM.
                return {
                    hash: params[0],
                    transactionIndex: '0x1',
                    blockNumber: '0x' + status["sync_info"]["latest_block_height"].toString(16),
                    blockHash: base58ToHex(status["sync_info"]["latest_block_hash"]),
                    from: "0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368",
                    nonce: '0x1',
                    gas: '0xffffffff',
                    gasPrice: '0x4a817c800',
                    to: null,
                    value: '0x0',
                    input: '0x',
                    v: "0x25", // 37
                    r: "0x1b5e176d927f8e9ab405058b2d2457392da3e20f328b16ddabcebc33eaac5fea",
                    s: "0x4ba69724e8f69de52f0125ad8b3c5c2cef33019bac3249e2c0a2192766d1721c"
                };
            }
            case "eth_getTransactionReceipt": {
                let status = await this.nearProvider.status();
                let outcome = await this.nearProvider.txStatus(Buffer.from(bs58.decode(params[0])), this.account.accountId);
                const responseHash = base64ToString(outcome.status.SuccessValue);
                // TODO: compute proper tx status: accumulate logs and gas.
                const result = {
                    transactionHash: params[0],
                    transactionIndex: '0x1',
                    blockNumber: '0x' + status["sync_info"]["latest_block_height"].toString(16),
                    blockHash: base58ToHex(status["sync_info"]["latest_block_hash"]),
                    contractAddress: '0x' + responseHash.slice(1, responseHash.length - 1),
                    gasUsed: decToHex(outcome.transaction.outcome.gas_burnt),
                    logs: outcome.transaction.outcome.logs,
                    status: '0x1',
                };
                return result;
            }
            case "eth_call": {
                let result = await this.account.viewFunction("evm", "view_call", { contract_address: "de5f4b90790d48e0c00348eb55c6d763a47a9443", encoded_input: params[0].data.slice(2) });
                return "0x" + result;
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
