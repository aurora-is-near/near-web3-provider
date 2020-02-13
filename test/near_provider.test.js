const fs = require('fs');
const web3 = require('web3');
const nearlib = require('nearlib');
const utils = require('../src/utils');
const { NearProvider } = require('../src/index');
const BN = require('bn.js');

/**------------------------------------------------
 * TESTS IN FLUX
 *
 * SPECIFY WHICH NET BY SETTING process.env.NEAR_TEST_ENV
 * (default)
 * $ export NEAR_TEST_ENV=local
 * or
 * $ export NEAR_TEST_ENV=testnet
 *
 * Need to setup making transactions
 *
 * Hashes are hardcoded. New transactions need to be made and the
 * hashesupdated whenever testnet resets.
 *
 * ------------------------------------------------
 */

let url;
const net = process.env.NEAR_TEST_ENV || 'local';

if (net === 'testnet') {
    url = 'https://rpc.nearprotocol.com';
} else {
    url = 'http://localhost:3030';
}

console.log(`-----------------------
Running tests on ${net} network
URL: ${url}
-----------------------`)

const networkId = 'local'; // see NearProvider constructor, src/index.js
const evmContract = 'evm';   // see NearProvider constructor, src/index.js
const nearEvmFile = './artifacts/near_evm.wasm';
const testNearProvider = new nearlib.providers.JsonRpcProvider(url);

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

function createWeb3Instance(accountId, keyPair) {
    // console.log('Creating web3 instance: ', accountId);
    const web = new web3();
    const keyStore = new nearlib.keyStores.InMemoryKeyStore();

    keyStore.setKey('test', accountId, keyPair);
    web.setProvider(new NearProvider(url, keyStore, accountId));

    // console.log('web3 provider created for account: ', web._provider.account.accountId);
    return web;
}

// Main/Sender Account. Majority of tests will use this instance of web3
const TEST_NEAR_ACCOUNT = 'test.near';
const mainKeyPair = createKeyPair();

const withWeb3 = (fn) => {
    const web = new web3();

    const keyPairString = 'ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw';
    const keyPair = nearlib.utils.KeyPair.fromString(keyPairString);
    const keyStore = new nearlib.keyStores.InMemoryKeyStore();

    // I don't know why this has to be 'test'
    keyStore.setKey('test', TEST_NEAR_ACCOUNT, keyPair);

    web.setProvider(new NearProvider(url, keyStore, TEST_NEAR_ACCOUNT));
    return () => fn(web);
};

async function deployContract(web) {
    const accountId = web._provider.account.accountId;
    console.log('Deploying EVM Contract on account: ', accountId);

    const evmCode = fs
        .readFileSync(nearEvmFile)
        .toString('hex');
    const evmBytecode = Uint8Array.from(Buffer.from(evmCode, 'hex'));
    const evmKeyPair = createKeyPair();

    // Set keypair
    try {
        await web._provider.keyStore.setKey(networkId, evmContract, evmKeyPair)
    } catch (e) {
        console.log('Setting key error', e);
    }

    try {
        console.log('web_provider', web._provider.account)

        const contract = await web._provider.account.createAndDeployContract(
            evmContract,                    // contractId
            evmKeyPair.getPublicKey(),      // publicKey
            evmBytecode,                    // data
            0                               // amount. NEAR value
        )
        console.log('EVM Contract Deployed', contract);
        return true;
    } catch (e) {
        console.log('Error deploying EVM Contract', e);
    }
}

describe('\n---- BASIC QUERIES ----', () => {
    beforeAll(withWeb3(async (web) => {
        const evmCode = fs.readFileSync('./artifacts/near_evm.wasm').toString('hex');
        const evmBytecode = Uint8Array.from(Buffer.from(evmCode, 'hex'));
        const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
        console.log('networkId variable', networkId)
        try {
            await web._provider.keyStore.setKey(networkId, 'evm', keyPair);

            const contract = await web._provider.account.createAndDeployContract(
                'evm',
                keyPair.getPublicKey(),
                evmBytecode,
                0)  // NEAR value
            console.log('deployed EVM contract', contract);
        } catch (e) {
            if (e.type === 'ActionError::AccountAlreadyExists') {
                console.log('EVM already deployed');
            } else {
                console.log('EVM deploy error', e);
            }
        }
    }));

    describe('isSyncing | eth_syncing', () => {
        test('returns correct type - Boolean|Object', withWeb3(async (web) => {
            try {
                const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
                const newAccount = await web._provider.account.createAccount('test.sync', keyPair.getPublicKey(), 2);

                console.log({newAccount})
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
            if (net === 'local') {
                expect(gasPrice).toEqual('0');
            } else {
                expect(parseInt(gasPrice)).toBeGreaterThan(0);
            }
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
                utils.nearAccountToEvmAddress(TEST_NEAR_ACCOUNT),
                'latest'
            );
            expect(typeof balance).toBe('string');
            expect(balance).toEqual('0');
        }));
    });

    describe('getStorageAt | eth_getStorageAt', () => {
        // TODO: test with a non-0 slot
        test('returns storage position', withWeb3(async (web) => {
            const address = utils.nearAccountToEvmAddress(TEST_NEAR_ACCOUNT);
            const position = 0;
            let storagePosition = await web.eth.getStorageAt(address, position);
            expect(typeof storagePosition).toBe('string');
            expect(storagePosition).toEqual(`0x${'00'.repeat(32)}`);
        }));
    });

    describe('getCode | eth_getCode', () => {
        // TODO: deploy a contract and test
        test('gets code', withWeb3(async (web) => {
            const address = utils.nearAccountToEvmAddress(TEST_NEAR_ACCOUNT);
            const code = await web.eth.getCode(address);
            expect(typeof code).toBe('string');
            expect(code).toEqual('0x');

        }));
    });

    describe('getTransactionCount | eth_getTransactionCount', () => {
        // TODO: call, make tx, call again to see if incremented
        test('returns transaction count', withWeb3(async (web) => {
            const address = utils.nearAccountToEvmAddress(TEST_NEAR_ACCOUNT);
            const txCount = await web.eth.getTransactionCount(address);

            expect(typeof txCount).toBe('number');
            expect(txCount).toBeGreaterThanOrEqual(0);
        }));

    });

});

describe.skip('\n---- BLOCK & TRANSACTION QUERIES ----', () => {
    let blockHash;
    let blockHeight;

    const base58TxHash = 'ByGDjvYxVZDxv69c86tFCFDRnJqK4zvj9uz4QVR4bH4P';
    const base58BlockHash = '3cdkbRn1hpNLH5Ri6pipy7AEAKJscPD7TCgLFs94nWGB';

    // TODO: These are for testnet. Make it so local testnet works
    const txHash = utils.base58ToHex(base58TxHash);
    const txIndex = 0;

    const testnetAccountId = 'dinoaroma';
    const localAccountId = 'test.near';

    beforeAll(withWeb3(async (web) => {
        if (net === 'testnet') {
            console.log('-----Using testnet-----');
            const block = await testNearProvider.block(base58BlockHash);
            blockHash = utils.base58ToHex(base58BlockHash);
            blockHeight = block.header.height;
        } else {
            const newBlock = getLatestBlockInfo();
            blockHash = newBlock.blockHash;
            blockHeight = newBlock.blockHeight;
            // TODO: Create txs
        }
    }));

    describe.skip('getBlockNumber | eth_blockNumber', () => {
        test('returns the most recent blockNumber', withWeb3(async (web) => {
            await waitForABlock();

            let blockNumber = await web.eth.getBlockNumber();
            expect(blockNumber).not.toBeNaN();
            expect(blockNumber).toBeGreaterThan(blockHeight);
        }));
    });

    describe.skip(`getBlock |
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
            expect(block.number).toEqual(blockHeight);
            expect(typeof block.transactions[0]).toBe('object');
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

    describe.skip(`getBlockTransactionCount |
        eth_getBlockTransactionCountByHash,
        eth_getBlockTransactionCountByNumber`, () => {

        // broken on local because no txns on regtest.
        test('gets block tx count by hash', withWeb3(async (web) => {
            const count = await web.eth.getBlockTransactionCount(blockHash);
            expect(count).not.toBeNaN();
            expect(typeof count).toBe('number');
            if (net === 'testnet') {
                expect(count).toEqual(1);
            } else {
                expect(count).toBeGreaterThanOrEqual(0);
            }
        }));

        // broken on local because no txns on regtest.
        test('gets block tx count by number', withWeb3(async (web) => {
            const count = await web.eth.getBlockTransactionCount(blockHeight);
            expect(count).not.toBeNaN();
            expect(typeof count).toBe('number');
            if (net === 'testnet') {
                expect(count).toEqual(1);
            } else {
                expect(count).toBeGreaterThanOrEqual(0);
            }
        }));
    });

    describe('getTransaction | eth_getTransactionByHash', () => {
        // broken on local because no txns on regtest.
        test('gets transaction by hash', withWeb3(async(web) => {
            const signerId = net === 'testnet'
                ? testnetAccountId
                : localAccountId;

            try {
                const tx = await web.eth.getTransaction(`${txHash}:${signerId}`);
                console.log({tx})

                if (net === 'testnet') {
                    expect(typeof tx).toBe('object');
                    expect(typeof tx.hash).toBe('string');
                    expect(tx.hash).toEqual(txHash)
                } else {
                    if (tx) {
                        expect(typeof tx).toBe('object');
                        expect(typeof tx.hash).toBe('string');
                    } else {
                        expect(tx).toBe(false);
                    }
                }
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
