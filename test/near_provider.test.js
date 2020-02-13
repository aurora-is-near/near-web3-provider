const fs = require('fs');
const web3 = require('web3');
const nearlib = require('nearlib');
const utils = require('../src/utils');
const NearProvider = require('../src');

let url;
const net = process.env.NEAR_TEST || 'local';

if (net === 'testnet') {
    url = 'https://rpc.nearprotocol.com';
} else {
    url = 'http://localhost:3030';
}

console.log(`-----------------------
Running tests on ${net} network
URL: ${url}
-----------------------`)

const networkId = 'default'; // see NearProvider constructor, src/index.js
const evmContract = 'evm';   // see NearProvider constructor, src/index.js
const nearEvmFile = './artifacts/near_evm.wasm';
const testNearProvider = new nearlib.providers.JsonRpcProvider(url);

function createKeyPair() {
    return nearlib.utils.KeyPair.fromRandom('ed25519');
}

function createWeb3Instance(accountId, keyPair) {
    console.log('Creating web3 instance: ', accountId);

    const web = new web3();
    const keyStore = new nearlib.keyStores.InMemoryKeyStore();

    keyStore.setKey(networkId, accountId, keyPair);
    web.setProvider(new NearProvider(url, keyStore, accountId));

    console.log('web3 provider created for account: ', web._provider.account.accountId);
    return web;
}

// Contract Account.
// const TEST_NEAR_CONTRACT_ACCOUNT = 'test.evm';
// const contractKeyPair = createKeyPair();
// const withWeb3Contract = (fn) => () => fn(createWeb3Instance(TEST_NEAR_CONTRACT_ACCOUNT, contractKeyPair));

// Main/Sender Account. Majority of tests will use this instance of web3
const TEST_NEAR_ACCOUNT = 'test.near';
const mainKeyPair = createKeyPair();
const withWeb3 = (fn) => {
    console.log('Creating web3 instance: ', TEST_NEAR_ACCOUNT);

    const web = new web3();
    const keyStore = new nearlib.keyStores.InMemoryKeyStore();

    keyStore.setKey(networkId, TEST_NEAR_ACCOUNT, mainKeyPair);
    web.setProvider(new NearProvider(url, keyStore, TEST_NEAR_ACCOUNT));

    console.log('web3 provider created for account: ', web._provider.account.accountId);
    return () => fn(web);
}

// Receiver Account. Create second account so we can have a place to send transactions
// const TEST_NEAR_ACCOUNT_RECEIVER = 'test.near.receiver';
// const receiverKeyPair = createKeyPair();
// const withWeb3Receiver = (fn) => () => fn(createWeb3Instance(TEST_NEAR_ACCOUNT_RECEIVER, receiverKeyPair));

// async function deployContract(web) {
//     const accountId = web._provider.account.accountId;
//     console.log('Deploying EVM Contract on account: ', accountId);

//     const evmCode = fs
//         .readFileSync(nearEvmFile)
//         .toString('hex');
//     const evmBytecode = Uint8Array.from(Buffer.from(evmCode, 'hex'));
//     const evmKeyPair = createKeyPair();

//     // Set keypair
//     try {
//         await web._provider.keyStore.setKey(networkId, evmContract, evmKeyPair)
//     } catch (e) {
//         console.log('Setting key error', e);
//     }

//     try {
//         console.log('web_provider', web._provider.account)

//         const contract = await web._provider.account.createAndDeployContract(
//             evmContract,                    // contractId
//             contractKeyPair.getPublicKey(), // publicKey
//             evmBytecode,                    // data
//             0                               // amount. NEAR value
//         )

//         console.log('EVM Contract Deployed', contract);
//         return true;
//     } catch (e) {
//         console.log('Error deploying EVM Contract', e);
//     }
// }

// beforeAll(withWeb3(async (web) => {
//     console.log('web3 with', web._provider);
//     console.log('accountId', web._provider.accountId);

//     // CREATE ACCOUNTS
//     const options = {
//         accountId: web._provider.accountId,
//         masterAccount: 'test.near'
//     }

//     const config = {
//         keyPath: '/Users/barbara/Code/nearprotocol/nearcore/testdir/validator_key.json',
//         deps: {
//             keyStore: web._provider.keyStore
//         },
//         networkId: networkId,
//         masterAccount: 'test.near'
//     }

//     try {
//         let near = await nearlib.connect(config);
//         console.log('done')
//     } catch (e) {
//         console.log('error', e);
//     }
// }));


// beforeAll(withWeb3(async (web) => {
//     const evmCode = fs.readFileSync('./artifacts/near_evm.wasm').toString('hex');
//     const evmBytecode = Uint8Array.from(Buffer.from(evmCode, 'hex'));
//     const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
//     await web._provider.keyStore.setKey(this.networkId, this.evm_contract, keyPair);
//     return web._provider.account.createAndDeployContract(
//         web._provider.evm_contract,
//         keyPair.getPublicKey(),
//         evmBytecode,
//         0  // NEAR value
//     ).then(() => {
//         console.log('deployed EVM contract');
//     }).catch((e) => {
//         console.log('EVM deployed error', e);
//     });
// }), 10000);

// test.only('returns correct type - Boolean|Object', withWeb3(async (web) => {
//     const sync = await web.eth.isSyncing();
//     const syncType = typeof sync;
//     expect(syncType).toBe('boolean' || 'object');

//     if (syncType === 'boolean') {
//         expect(sync).toBe(false);
//     }
// }));

describe('#web3.eth', () => {

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

    describe.only(`getBlock |
        eth_getBlockByHash,
        eth_getBlockByNumber`, () => {

        let blockHash;
        let blockHeight;

        const base58TxHash = 'ByGDjvYxVZDxv69c86tFCFDRnJqK4zvj9uz4QVR4bH4P';
        const base58BlockHash = '3cdkbRn1hpNLH5Ri6pipy7AEAKJscPD7TCgLFs94nWGB';

        beforeAll(withWeb3(async (web) => {
            if (net === 'testnet') {
                console.log('-----Using testnet-----')


                const block = await testNearProvider.block(base58BlockHash);
                blockHash = utils.base58ToHex(base58BlockHash);
                blockHeight = block.header.height;
            } else {
                const { sync_info } = await testNearProvider.status();
                const { latest_block_hash, latest_block_height } = sync_info;
                blockHash = utils.base58ToHex(latest_block_hash);
                blockHeight = latest_block_height;
            }
        }));

        test('gets block by hash', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHash);

            console.log('testblock', block);
            expect(block.hash).toEqual(blockHash);
            expect(block.number).toEqual(blockHeight);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'string').toBe(true);
                expect(block.transactions[0]).toEqual(utils.base58ToHex(base58TxHash));
            }
            expect(typeof block.timestamp === 'number').toBe(true);
        }));

        test('gets block by hash with full tx objs', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHash, true);

            console.log('testblock hash', block)
            expect(block.hash).toEqual(blockHash);
            expect(block.number).toEqual(blockHeight);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'object').toBe(true);
                expect(typeof block.transactions[0].hash).toBe('string');
                expect(block.transactions[0].hash).toEqual(utils.base58ToHex(base58TxHash));
            }
        }));

        // test.skip('gets block by number', withWeb3(async (web) => {
        //     const block = await web.eth.getBlock(blockHeight);
        //     expect(block.hash).toEqual(blockHash);
        //     expect(block.number).toEqual(blockHeight);
        //     if (block.transactions.length > 0) {
        //         expect(typeof block.transactions[0] === 'string').toBe(true);
        //     }
        // }));

        // // broken because blockObj never awaits _getTxsFromChunks
        // test.skip('gets block by number with full tx objs', withWeb3(async (web) => {
        //     const block = await web.eth.getBlock(blockHeight, true);
        //     expect(block.number).toEqual(blockHeight);
        //     expect(typeof block.transactions[0] === 'object').toBe(true);
        // }));

        // test.skip('gets block by string - "latest"', withWeb3(async (web) => {
        //     const blockString = 'latest';

        //     // wait for a new block
        //     await new Promise(r => setTimeout(r, 1000));
        //     const block = await web.eth.getBlock(blockString);
        //     expect(block.number).toBeGreaterThan(blockHeight);
        //     expect(Array.isArray(block.transactions)).toBe(true);
        //     if (block.transactions.length > 0) {
        //         expect(typeof block.transactions[0] === 'string').toBe(true);
        //     }
        // }));
    });

    describe(`getBlockTransactionCount |
        eth_getBlockTransactionCountByHash,
        eth_getBlockTransactionCountByNumber`, () => {

        let blockHash;
        let blockHeight;

        // beforeAll(withWeb3(async (web) => {
        //     const { sync_info } = await web._provider.nearProvider.status();
        //     let { latest_block_hash, latest_block_height } = sync_info;

        //     blockHash = utils.base58ToHex(latest_block_hash);
        //     blockHeight = latest_block_height;
        // }));

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
