const fs = require('fs');
const web3 = require('web3');
const nearlib = require('nearlib');
const utils = require('../src/utils');
const NearProvider = require('../src/index');

const TEST_NEAR_ACCOUNT = 'test.near';

const TEST_NEAR_ACCOUNT = 'test.near';
const TEST_NEAR_ACCOUNT_RECEIVER = test.near.receiver;

function createWeb3Instance(accountId, keyPair) {
    const web = new web3();

    const keyStore = new nearlib.keyStores.InMemoryKeyStore();
    keyStore.setKey('test', accountId, keyPair);

    web.setProvider(new NearProvider('http://localhost:3030', keyStore, accountId));

    return web;
}

// Main/Sender Account. Majority of tests will use this instance of web3
const keyPairString = 'ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw';
const senderKeyPair = nearlib.utils.KeyPair.fromString(keyPairString);
const withWeb3 = (fn) => fn(createWeb3Instance(TEST_NEAR_ACCOUNT, senderKeyPair));


// Receiver Account. Create second account so we can have a place to send transactions
const receiverKeyPair = nearlib.utils.KeyPair.fromRandom('receiver key');
const withWeb3Receiver = fn(createWeb3Instance(TEST_NEAR_ACCOUNT_RECEIVER, receiverKeyPair));
// const withWeb3 = (fn) => {
//     const web = new web3();

//     const accountId = 'test.near';
//     const keyPairString = 'ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw';
//     const keyPair = nearlib.utils.KeyPair.fromString(keyPairString);
//     const keyStore = new nearlib.keyStores.InMemoryKeyStore();
//     keyStore.setKey('test', accountId, keyPair);

//     web.setProvider(new NearProvider('http://localhost:3030', keyStore, accountId));
//     return () => fn(web);
// };




// NEW BLOCK INFO
// '0xaee2455a8605f67af54e7e7c6f3c216606c14d89c3180ad00fff41a178743b17'
// 'Cmg4AWrjLo8AfgtyLMAb3YUnMujfgRg2qH9DFxzzRuvN'
// 1367550
// Wed Feb 05 2020 11: 17: 47 GMT - 0700(Mountain Standard Time)

// '9TWEeS11Up9nR9AobKWdKfzmF9j1TriB8TLbRCZqznia' which is block number
// 1221180, from 2020-02-03T23:18:52.817928262Z
const blockHash = '0x7da7a7223c6677bf0f2b775b60f76832fab71441280ba94eb98af68dd17a8367';
const blockNumber = 1221180;
// NB: txHash is hex equivalent of
// 'CdyVerDt7BNr8jAbFuxKQB3rjogtr8R7aQJpuiMxMLzK' found at index 0 of
// blockNumber 1221180

// txHash is hex equivalent of '8Ha8nvE7t1wHB8h5GdzMCnbDfCs9Zg1XeSLHo1umCVPy'
// with accountId 'dinoaroma'
// found in block 'Cmg4AWrjLo8AfgtyLMAb3YUnMujfgRg2qH9DFxzzRuvN'
const txHash = '0x6c409109338aa109c3b696ba855ff5543a70204ce127e5991fff45c9fd60051c';
const txIndex = 0;
    const keyPairString = 'ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw';
    const keyPair = nearlib.utils.KeyPair.fromString(keyPairString);
    const keyStore = new nearlib.keyStores.InMemoryKeyStore();
    keyStore.setKey('test', TEST_NEAR_ACCOUNT, keyPair);

    web.setProvider(new NearProvider('http://localhost:3030', keyStore, TEST_NEAR_ACCOUNT));
    return () => fn(web);
};


describe('#web3.eth', () => {

    beforeAll(withWeb3(async (web) => {
        const evmCode = fs.readFileSync('./artifacts/near_evm.wasm').toString('hex');
        const evmBytecode = Uint8Array.from(Buffer.from(evmCode, 'hex'));
        const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
        await web._provider.keyStore.setKey(this.networkId, this.evm_contract, keyPair);
        return web._provider.account.createAndDeployContract(
            web._provider.evm_contract,
            keyPair.getPublicKey(),
            evmBytecode,
            0  // NEAR value
        ).then(() => {
            console.log('deployed EVM contract');
        }).catch(() => {
            console.log('EVM already deployed');
        });
    }), 10000);

    describe('isSyncing | eth_syncing', () => {
        test('returns correct type - Boolean|Object', withWeb3(async (web) => {
            const sync = await web.eth.isSyncing();
            const syncType = typeof sync;
            expect(syncType).toBe('boolean' || 'object');

            if (syncType === 'boolean') {
                expect(sync).toBe(false);
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

    describe('getAccounts | eth_accounts', () => {
        test('returns accounts', withWeb3(async (web) => {
            const accounts = await web.eth.getAccounts();
            expect(Array.isArray(accounts)).toBe(true);
            expect(accounts[0]).toEqual('0xCBdA96B3F2B8eb962f97AE50C3852CA976740e2B');
        }));
    });

    describe('getBlockNumber | eth_blockNumber', () => {
        test('returns a blockNumber', withWeb3(async (web) => {
            let blockNumber = await web.eth.getBlockNumber();
            expect(blockNumber).toBeGreaterThan(0);
            expect(blockNumber).not.toBeNaN();
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

    // Broken without contract deploy
    describe('getCode | eth_getCode', () => {
        // TODO: deploy a contract and test
        test('gets code', withWeb3(async (web) => {
            const address = utils.nearAccountToEvmAddress(TEST_NEAR_ACCOUNT);
            const code = await web.eth.getCode(address);
            expect(typeof code).toBe('string');
            expect(code).toEqual('0x');

        }));
    });

    describe(`getBlock |
        eth_getBlockByHash,
        eth_getBlockByNumber`, () => {

        let blockHash;
        let blockHeight;

        beforeAll(withWeb3(async (web) => {
            const { sync_info } = await web._provider.nearProvider.status();
            let { latest_block_hash, latest_block_height } = sync_info;

            blockHash = utils.base58ToHex(latest_block_hash);
            blockHeight = latest_block_height;
        }));

        test('gets block by hash', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHash);

            expect(block.hash).toEqual(blockHash);
            expect(block.number).toEqual(blockHeight);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'string').toBe(true);
            }
            expect(typeof block.timestamp === 'number').toBe(true);
        }));

        // broken because blockObj never awaits _getTxsFromChunks
        test.skip('gets block by hash with full tx objs', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHash, true);
            expect(block.hash).toEqual(blockHash);
            expect(block.number).toEqual(blockHeight);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'object').toBe(true);
            }
        }));

        test('gets block by number', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHeight);
            expect(block.hash).toEqual(blockHash);
            expect(block.number).toEqual(blockHeight);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'string').toBe(true);
            }
        }));

        // broken because blockObj never awaits _getTxsFromChunks
        test.skip('gets block by number with full tx objs', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHeight, true);
            expect(block.number).toEqual(blockHeight);
            expect(typeof block.transactions[0] === 'object').toBe(true);
        }));

        test('gets block by string - "latest"', withWeb3(async (web) => {
            const blockString = 'latest';

            // wait for a new block
            await new Promise(r => setTimeout(r, 1000));
            const block = await web.eth.getBlock(blockString);
            expect(block.number).toBeGreaterThan(blockHeight);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'string').toBe(true);
            }
        }));
    });

    describe(`getBlockTransactionCount |
        eth_getBlockTransactionCountByHash,
        eth_getBlockTransactionCountByNumber`, () => {

        let blockHash;
        let blockHeight;

        beforeAll(withWeb3(async (web) => {
            const { sync_info } = await web._provider.nearProvider.status();
            let { latest_block_hash, latest_block_height } = sync_info;

            blockHash = utils.base58ToHex(latest_block_hash);
            blockHeight = latest_block_height;
        }));

        // broken because no txns on regtest. TODO: make a tx in the beforeAll
        test.skip('gets block transaction count by hash', withWeb3(async (web) => {
            const count = await web.eth.getBlockTransactionCount(blockHash);
            expect(typeof count === 'number');
            expect(count).toEqual(8);
        }));

        // broken because no txns on regtest. TODO: make a tx in the beforeAll
        test.skip('gets block transaction count by number', withWeb3(async (web) => {
            const count = await web.eth.getBlockTransactionCount(blockHeight);
            expect(typeof count === 'number');
            expect(count).toEqual(8);
        }));
    });

    describe('getTransaction | eth_getTransactionByHash', () => {
        // broken because no txns on regtest. TODO: make a tx in the beforeAll
        test.skip('gets transaction by hash', withWeb3(async(web) => {
            const tx = await web.eth.getTransaction(txHash + ':dinoaroma');
            expect(typeof tx === 'object').toBe(true);
            expect(typeof tx.hash === 'string').toBe(true);
        }));
    });

    describe('getTransactionCount | eth_getTransactionCount', () => {
        // TODO: call, make tx, call again to see if incremented
        // CONSIDER: should this return the Ethereum account nonce?
        test.skip('returns transaction count', withWeb3(async (web) => {
            const address = utils.nearAccountToEvmAddress(TEST_NEAR_ACCOUNT);
            const txCount = await web.eth.getTransactionCount(address);

            expect(typeof txCount).toBe('number');
            expect(txCount).toBeGreaterThanOrEqual(0);
        }));

    });

    describe(`getTransactionFromBlock |
        eth_getTransactionByBlockHashAndIndex,
        eth_getTransactionByBlockNumberAndIndex`, () => {
        // broken because no txns on regtest.
        test.skip('returns transaction from block hash', withWeb3(async (web) => {
            const tx = await web.eth.getTransactionFromBlock(blockHash, 'txIndex');
            expect(typeof tx).toBe('object');
            expect(tx.hash).toEqual(txHash);
        }));

        // broken because no txns on regtest.
        test.skip('returns transaction from block number', withWeb3(async (web) => {
            const tx = await web.eth.getTransactionFromBlock(blockNumber, txIndex);
            expect(typeof tx).toBe('object');
            expect(tx.hash).toEqual(txHash);
        }));

        // broken because no txns on regtest.
        test.skip('returns transaction from string - latest', withWeb3(async (web) => {
            const tx = await web.eth.getTransactionFromBlock('latest', txIndex);
            expect(typeof tx).toBe('object');
            expect(typeof tx.hash).toEqual('string');
        }));
    });
});


// describe('#web3.eth.net', () => {
//     describe('isListening', () => {
//         test('expect node to be listening', withWeb3(async (web) => {
//             const isListening = await web.eth.net.isListening();
//             expect(isListening).toBe(true);
//         }));
//     });
// });

// test('sendTx', withWeb3(async (web) => {
//     const rawTransaction = {
//         "from": "illia",
//         "to": "alex",
//         "value": web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
//         "gas": 200000,
//         "chainId": 3
//     };
//     let pk = '0x6ba33b3f7997c2bf63d82f3baa1a8069014a59fa1f554af3266aa85afee9d0a9';
//     pk = new Buffer(pk, 'hex');
//     const address = '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368';

//     signedTx = await web.eth.accounts.signTransaction(rawTransaction, rawTransaction.from);
//     console.warn(signedTx);
// }));

// test('isSyncing', withWeb3(async (web) => {

// }));
