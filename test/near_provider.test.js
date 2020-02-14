const fs = require('fs');
const web3 = require('web3');
const nearlib = require('nearlib');
const utils = require('../src/utils');
const { NearProvider } = require('../src/index');

/**------------------------------------------------
 * TESTS IN FLUX
 *
 * Need to setup making transactions
 *
 * Hashes are hardcoded. New transactions need to be made and the
 * hashesupdated whenever testnet resets.
 *
 * ------------------------------------------------
 */

let url = 'http://localhost:3030';
const networkId = 'local'; // see NearProvider constructor, src/index.js
const nearEvmFile = './artifacts/near_evm.wasm';
const testNearProvider = new nearlib.providers.JsonRpcProvider(url);

console.log(`-----------------------
Running tests on ${networkId} network
URL: ${url}
-----------------------`);


function createKeyPair() {
    return nearlib.utils.KeyPair.fromRandom('ed25519');
}

async function getLatestBlockInfo() {
    const { sync_info } = await testNearProvider.status();
    const { latest_block_hash, latest_block_height } = sync_info;
    const block = {
        blockHash: utils.base58ToHex(latest_block_hash),
        blockHeight: latest_block_height
    };

    return block;
}

async function waitForABlock() {
    return await new Promise((r) => setTimeout(r, 1000));
}

// Main/Sender Account. Majority of tests will use this instance of web3
const LOCAL_NEAR_ACCOUNT = 'test.near';

const withWeb3 = (fn) => {
    const web = new web3();

    const keyPairString = 'ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw';
    const keyPair = nearlib.utils.KeyPair.fromString(keyPairString);
    const keyStore = new nearlib.keyStores.InMemoryKeyStore();

    // I don't know why this has to be 'test'
    keyStore.setKey('test', LOCAL_NEAR_ACCOUNT, keyPair);

    web.setProvider(new NearProvider(url, keyStore, LOCAL_NEAR_ACCOUNT));
    return () => fn(web);
};

describe('\n---- PROVIDER ----', () => {
    beforeAll(withWeb3(async (web) => {
        const evmCode = fs.readFileSync(nearEvmFile).toString('hex');
        const evmBytecode = Uint8Array.from(Buffer.from(evmCode, 'hex'));
        const keyPair = createKeyPair();
        console.log('networkId variable', networkId);
        try {
            await web._provider.keyStore.setKey(networkId, 'evm', keyPair);
            const contract = await web._provider.account.createAndDeployContract(
                'evm',
                keyPair.getPublicKey(),
                evmBytecode,
                0);  // NEAR value
            console.log('deployed EVM contract', contract);
        } catch (e) {
            if (e.type === 'ActionError::AccountAlreadyExists') {
                console.log('EVM already deployed');
            } else {
                console.log('EVM deploy error', e);
            }
        }
    }));

    describe('\n---- BASIC QUERIES ----', () => {
        describe('isSyncing | eth_syncing', () => {
            test('returns correct type - Boolean|Object', withWeb3(async (web) => {
                try {
                    const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
                    const newAccount = await web._provider.account.createAccount('test.sync', keyPair.getPublicKey(), 2);

                    console.log({newAccount});
                    const sync = await web.eth.isSyncing();
                    const syncType = typeof sync;
                    expect(syncType).toBe('boolean' || 'object');

                    if (syncType === 'boolean') {
                        expect(sync).toBe(false);
                    }
                } catch (e) {
                    return e;
                }
            }));

            test('returns object if syncing', withWeb3(async (web) => {
                const sync = await web.eth.isSyncing();
                const syncType = typeof sync;
                expect(syncType).toBe('boolean' || 'object');

                if (syncType === 'object') {
                    expect.objectContaining({
                        startingBlock: expect.any(Number),
                        currentBlock: expect.any(Number),
                        highestBlock: expect.any(Number),
                        knownStates: expect.any(Number),
                        pulledStates: expect.any(Number)
                    });
                }
            }));
        });

        describe('getGasPrice | eth_gasPrice', () => {
            test('returns gasPrice', withWeb3(async (web) => {
                const gasPrice = await web.eth.getGasPrice();
                expect(typeof gasPrice).toBe('string');
                expect(gasPrice).toEqual('0');
            }));
        });
    });

    describe('\n---- CONTRACT INTERACTION ----', () => {
        describe('getAccounts | eth_accounts', () => {
            test('returns accounts', withWeb3(async (web) => {
                try {
                    const accounts = await web.eth.getAccounts();
                    expect(Array.isArray(accounts)).toBe(true);
                    // TODO: Test accounts
                    // console.log({accounts})
                    // expect(accounts[0]).toEqual('0xCBdA96B3F2B8eb962f97AE50C3852CA976740e2B');
                } catch (e) {
                    console.log(e);
                }
            }));
        });

        describe('getBalance | eth_getBalance', () => {
            // TODO: test with a non-0 balance
            test('returns balance', withWeb3(async (web) => {
                const balance = await web.eth.getBalance(
                    utils.nearAccountToEvmAddress(LOCAL_NEAR_ACCOUNT),
                    'latest'
                );
                expect(typeof balance).toBe('string');
                expect(balance).toEqual('0');
            }));
        });

        describe('getStorageAt | eth_getStorageAt', () => {
            // TODO: test with a non-0 slot
            test('returns storage position', withWeb3(async (web) => {
                const address = utils.nearAccountToEvmAddress(LOCAL_NEAR_ACCOUNT);
                const position = 0;
                let storagePosition = await web.eth.getStorageAt(address, position);
                expect(typeof storagePosition).toBe('string');
                expect(storagePosition).toEqual(`0x${'00'.repeat(32)}`);
            }));
        });

        describe('getCode | eth_getCode', () => {
            // TODO: deploy a contract and test
            test('gets code', withWeb3(async (web) => {
                const address = utils.nearAccountToEvmAddress(LOCAL_NEAR_ACCOUNT);
                const code = await web.eth.getCode(address);
                expect(typeof code).toBe('string');
                expect(code).toEqual('0x');

            }));
        });

        describe('getTransactionCount | eth_getTransactionCount', () => {
            // TODO: call, make tx, call again to see if incremented
            test('returns transaction count', withWeb3(async (web) => {
                const address = utils.nearAccountToEvmAddress(LOCAL_NEAR_ACCOUNT);
                const txCount = await web.eth.getTransactionCount(address);

                expect(typeof txCount).toBe('number');
                expect(txCount).toBeGreaterThanOrEqual(0);
            }));

        });

        describe('call | eth_call', () => {

        });

    });

    describe('\n---- BLOCK & TRANSACTION QUERIES ----', () => {
        let blockHash;
        let blockHeight;
        let transactionHash;

        const base58TxHash = 'ByGDjvYxVZDxv69c86tFCFDRnJqK4zvj9uz4QVR4bH4P';

        // TODO: These are for testnet. Make it so local testnet works
        const txHash = utils.base58ToHex(base58TxHash);
        const txIndex = 0;

        beforeAll(withWeb3(async (web) => {
            const newBlock = await getLatestBlockInfo();
            blockHash = newBlock.blockHash;
            blockHeight = newBlock.blockHeight;
            const txResult = await web.eth.sendTransaction(
                {from: '00'.repeat(20), to: '00'.repeat(20), value: 0, gas: 0, data: '0x00'}
            );
            transactionHash = txResult.transactionHash;
        }));

        describe('getBlockNumber | eth_blockNumber', () => {
            test('returns the most recent blockNumber', withWeb3(async (web) => {
                await waitForABlock();
                let blockNumber = await web.eth.getBlockNumber();
                expect(blockNumber).not.toBeNaN();
                expect(blockNumber).toBeGreaterThan(blockHeight);
            }));
        });

        describe(`getBlock |
            eth_getBlockByHash,
            eth_getBlockByNumber`, () => {

            test('gets block by hash', withWeb3(async (web) => {
                const block = await web.eth.getBlock(blockHash);

                expect(block.hash).toEqual(blockHash);
                expect(block.number).toEqual(blockHeight);
                expect(Array.isArray(block.transactions)).toBe(true);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0]).toBe('string');
                    expect(block.transactions[0]).toEqual(utils.base58ToHex(base58TxHash));
                }
                expect(typeof block.timestamp).toBe('number');
            }));

            test('gets block by hash with full tx objs', withWeb3(async (web) => {
                const block = await web.eth.getBlock(blockHash, true);

                expect(block.hash).toEqual(blockHash);
                expect(block.number).toEqual(blockHeight);
                expect(Array.isArray(block.transactions)).toBe(true);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0] === 'object').toBe(true);
                    expect(typeof block.transactions[0].hash).toBe('string');
                    expect(block.transactions[0].hash).toEqual(utils.base58ToHex(base58TxHash));
                }
            }));

            test('gets block by number', withWeb3(async (web) => {
                try {
                    const block = await web.eth.getBlock(blockHeight);
                    expect(block.hash).toEqual(blockHash);
                    expect(block.number).toEqual(blockHeight);
                    if (block.transactions.length > 0) {
                        expect(typeof block.transactions[0]).toBe('string');
                    }
                } catch (e) {
                    expect(e).toBe(null);
                }
            }));

            test('gets block by number with full tx objs', withWeb3(async (web) => {
                const block = await web.eth.getBlock(blockHeight, true);

                expect(block.hash).toEqual(blockHash);
                expect(block.number).toEqual(blockHeight);
                expect(Array.isArray(block.transactions)).toBe(true);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0] === 'object').toBe(true);
                    expect(typeof block.transactions[0].hash).toBe('string');
                    expect(block.transactions[0].hash).toEqual(utils.base58ToHex(base58TxHash));
                }
            }));

            test('gets block by string - "latest"', withWeb3(async (web) => {
                const blockString = 'latest';

                await waitForABlock();

                try {
                    const block = await web.eth.getBlock(blockString);
                    expect(block.number).toBeGreaterThan(blockHeight);
                    expect(Array.isArray(block.transactions)).toBe(true);
                    if (block.transactions.length > 0) {
                        expect(typeof block.transactions[0]).toBe('string');
                    }
                } catch (e) {
                    expect(e).toBe(null);
                }
            }));
        });

        describe(`getBlockTransactionCount |
            eth_getBlockTransactionCountByHash,
            eth_getBlockTransactionCountByNumber`, () => {

            // broken on local because no txns on regtest.
            test('gets block tx count by hash', withWeb3(async (web) => {
                const count = await web.eth.getBlockTransactionCount(blockHash);
                expect(count).not.toBeNaN();
                expect(typeof count).toBe('number');
                expect(count).toBeGreaterThanOrEqual(0);
            }));

            // broken on local because no txns on regtest.
            test('gets block tx count by number', withWeb3(async (web) => {
                const count = await web.eth.getBlockTransactionCount(blockHeight);
                expect(count).not.toBeNaN();
                expect(typeof count).toBe('number');
                expect(count).toBeGreaterThanOrEqual(0);
            }));
        });

        describe('getTransaction | eth_getTransactionByHash', () => {
            // broken on local because no txns on regtest.
            test('fails to get non-existant transactions', withWeb3(async(web) => {
                try {
                    const tx = await web.eth.getTransaction(`${base58TxHash}:${LOCAL_NEAR_ACCOUNT}`);
                    expect(tx).toBeNull();
                } catch (e) {
                    return e;
                }
            }), 11000);

            test('it gets a transaction by hash', withWeb3(async(web) => {
                try {
                    const tx = await web.eth.getTransaction(transactionHash);
                    expect(tx).toBeOk();
                    expect(tx.contractAddress).toBeNull();
                    expect(tx.status).toBe(true);
                } catch (e) {
                    return e;
                }
            }));
        });

        describe(`getTransactionFromBlock |
            eth_getTransactionByBlockHashAndIndex,
            eth_getTransactionByBlockNumberAndIndex`, () => {
            // broken on local because no txns on regtest.
            test('returns transaction from block hash', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock(blockHash, txIndex);
                expect(typeof tx).toBe('object');
                if (tx) {
                    expect(typeof tx.hash).toBe('string');
                    expect(tx.hash).toEqual(txHash);
                }
            }));

            // broken on local because no txns on regtest.
            test('returns transaction from block number', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock(blockHeight, txIndex);
                expect(typeof tx).toBe('object');
                if (tx) {
                    expect(typeof tx.hash).toBe('string');
                    expect(tx.hash).toEqual(txHash);
                }
            }));

            // broken on local because no txns on regtest.
            test('returns transaction from string - latest', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock('latest', txIndex);
                expect(typeof tx).toBe('object');
                if (tx) {
                    expect(typeof tx.hash).toBe('string');
                }
            }));

            test('returns tx from string - genesis', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock('earliest', txIndex);
                expect(typeof tx).toBe('object');
                if (tx) {
                    expect(typeof tx.hash).toBe('string');
                }
            }));
        });
    });
});
