const NearProvider = require('../index');
const web3 = require('web3');

const withWeb3 = (fn) => {
    const web = new web3();
    // web.setProvider(new NearProvider('http://localhost:3030'));
    web.setProvider(new NearProvider('https://rpc.nearprotocol.com'));
    return () => fn(web);
};

const TEST_NEAR_ACCOUNT = '0xd148eC3d91AB223AD19051CE651fab2Cf0bE6410';
// NB: This is the hex equivalent of NEAR block hash

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
        }));
    });

    describe('getAccounts | eth_accounts', () => {
        test('returns accounts', withWeb3(async (web) => {
            const accounts = await web.eth.getAccounts();
            expect(Array.isArray(accounts)).toBe(true);
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
        test('returns balance', withWeb3(async (web) => {
            try {
                const balance = await web.eth.getBalance('0xB15D9b7C2F10a50dda6D88F40fb338cE514AF551', 'latest');
                console.log({balance});
                expect(typeof balance).toBe('string');
            } catch (e) {
                console.log(e);
            }
        }));
    });

    describe('getStorageAt | eth_getStorageAt', () => {
        test('returns storage position', withWeb3(async (web) => {
            const address = TEST_NEAR_ACCOUNT;
            const position = 0;
            let storagePosition = await web.eth.getStorageAt(address, position);
            console.log({storagePosition});
            expect(typeof storagePosition).toBe('string');
        }));
    });

    describe('getCode | eth_getCode', () => {
        test('gets code', withWeb3(async (web) => {
            const address = TEST_NEAR_ACCOUNT;
            const code = await web.eth.getCode(address);
            console.log({code});
            expect(typeof code).toBe('string');
        }));
    });

    describe(`getBlock |
        eth_getBlockByHash,
        eth_getBlockByNumber`, () => {
        test.only('gets block by hash', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHash);

            expect(block.hash).toEqual(blockHash);
            expect(block.number).toEqual(blockNumber);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'string').toBe(true);
            }
            expect(typeof block.timestamp === 'number').toBe(true);
        }));

        test('gets block by hash with full tx objs', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockHash, true);
            expect(block.hash).toEqual(blockHash);
            expect(block.number).toEqual(blockNumber);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'object').toBe(true);
            }
        }));

        test('gets block by number', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockNumber);
            expect(block.number).toEqual(blockNumber);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'string').toBe(true);
            }
        }));

        test('gets block by number with full tx objs', withWeb3(async (web) => {
            const block = await web.eth.getBlock(blockNumber, true);
            expect(block.number).toEqual(blockNumber);
            expect(typeof block.transactions[0] === 'object').toBe(true);
        }));

        test('gets block by string - "latest"', withWeb3(async (web) => {
            const blockString = 'latest';
            const block = await web.eth.getBlock(blockString);
            expect(block.number).toBeGreaterThan(blockNumber);
            expect(Array.isArray(block.transactions)).toBe(true);
            if (block.transactions.length > 0) {
                expect(typeof block.transactions[0] === 'string').toBe(true);
            }
        }));
    });

    describe(`getBlockTransactionCount |
        eth_getBlockTransactionCountByHash,
        eth_getBlockTransactionCountByNumber`, () => {
        test('gets block transaction count by hash', withWeb3(async (web) => {
            const count = await web.eth.getBlockTransactionCount(blockHash);
            expect(typeof count === 'number');
            expect(count).toEqual(8);
        }));

        test('gets block transaction count by number', withWeb3(async (web) => {
            const count = await web.eth.getBlockTransactionCount(blockNumber);
            expect(typeof count === 'number');
            expect(count).toEqual(8);
        }));
    });

    describe('getTransaction | eth_getTransactionByHash', () => {
        test('gets transaction by hash', withWeb3(async(web) => {
            const tx = await web.eth.getTransaction(txHash + ':dinoaroma');
            expect(typeof tx === 'object').toBe(true);
            expect(typeof tx.hash === 'string').toBe(true);
        }));
    });

    describe('getTransactionCount | eth_getTransactionCount', () => {
        test('returns transaction count', withWeb3(async (web) => {
            const address = TEST_NEAR_ACCOUNT;
            const txCount = await web.eth.getTransactionCount(address);

            expect(typeof txCount).toBe('number');
            expect(txCount).toBeGreaterThanOrEqual(0);
        }));

    });

    describe(`getTransactionFromBlock |
        eth_getTransactionByBlockHashAndIndex,
        eth_getTransactionByBlockNumberAndIndex`, () => {
        test('returns transaction from block hash', withWeb3(async (web) => {
            const tx = await web.eth.getTransactionFromBlock(blockHash, txIndex);
            expect(typeof tx).toBe('object');
            expect(tx.hash).toEqual(txHash);
        }));

        test('returns transaction from block number', withWeb3(async (web) => {
            const tx = await web.eth.getTransactionFromBlock(blockNumber, txIndex);
            expect(typeof tx).toBe('object');
            expect(tx.hash).toEqual(txHash);
        }));

        test('returns transaction from string - latest', withWeb3(async (web) => {
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
