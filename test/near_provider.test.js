/**
 * These tests default to running a local NEAR node. nearcore must be
 * running at the same folder level.
 */

const fs = require('fs');
const web3 = require('web3');
const bn = web3.utils.BN;
const { NearProvider, nearWeb3Extensions, nearAPI, utils } = require('../src/index');
const { waitForABlock, getLatestBlockInfo } = require('./helpers');

let source = fs.readFileSync('./test/build/contracts/ZombieAttack.json');
const zombieCode = JSON.parse(source)['bytecode'];
const zombieABI = JSON.parse(source)['abi'];

// see NearProvider constructor, src/index.js
const NEAR_ENV = process.env.NEAR_ENV || 'local';

const config = require('./config')[NEAR_ENV];
const NODE_URL = config.nodeUrl;
const ACCOUNT = require(config.keyPath);
// Main/Sender Account. Default is test.near
const ACCOUNT_ID = ACCOUNT.account_id;
const ACCOUNT_KEY = ACCOUNT.secret_key;
const ACCOUNT_KEYPAIR = nearAPI.utils.KeyPair.fromString(ACCOUNT_KEY);
const EVM_ACCOUNT = 'evm';

const testNearProvider = new nearAPI.providers.JsonRpcProvider(NODE_URL);

console.log(`-----------------------
Running tests on ${NEAR_ENV} network
NODE_URL: ${config.nodeUrl}
Account Id: ${ACCOUNT_ID}
Public Key: ${ACCOUNT.public_key}
-----------------------`);

const withWeb3 = (fn) => {
    const web = new web3();
    const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
    keyStore.setKey(NEAR_ENV, ACCOUNT_ID, ACCOUNT_KEYPAIR);
    let provider = new NearProvider({
        nodeUrl: config.nodeUrl,
        keyStore,
        masterAccountId: ACCOUNT_ID,
        networkId: NEAR_ENV,
    });
    web.setProvider(provider);
    web.extend(nearWeb3Extensions(web));
    return () => fn(web);
};

// Read-only provider
const withWeb3View = (fn) => {
    const web = new web3();
    const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
    keyStore.setKey(NEAR_ENV, ACCOUNT_ID, ACCOUNT_KEYPAIR);
    let provider = new NearProvider({
        nodeUrl: config.nodeUrl,
        keyStore,
        isReadOnly: true,
        networkId: NEAR_ENV,
    });
    web.setProvider(provider);
    web.extend(nearWeb3Extensions(web));
    return () => fn(web);
};

/**
 * Checks if account exists
 */
async function accountExists(web, accountName) {
    try {
        await web._provider.nearProvider.query(`account/${accountName}`, '');
        return true;
    } catch (e) {
        if (e.message === `[-32000] Server error: account ${accountName} does not exist while viewing`) {
            console.log(`Account "${accountName}" does not exist`);
        } else {
            console.error('accountExists error', e);
        }
        return false;
    }
}

/**
 * Creates an EVM Transaction
 * @returns transaction result aka transaction receipt
 */
async function createEvmTransaction(web) {
    try {
        const account = utils.nearAccountToEvmAddress(ACCOUNT_ID);
        const txResult = await web.eth.sendTransaction({
            from: account,
            to: account,
            value: 19,
            gas: 0
        });

        return txResult;
    } catch (e) {
        return e;
    }
}

describe('\n---- PROVIDER ----', () => {
    beforeAll(withWeb3(async (web) => {
        const exists = await accountExists(web, EVM_ACCOUNT);
        expect(exists).toBeTruthy();
    }));

    describe('\n---- BASIC QUERIES ----', () => {
        describe('getProtocolVersion | eth_protocolVersion', () => {
            test('returns protocol version', withWeb3(async (web) => {
                // Get current version
                const { version: { version } } = await testNearProvider.status();
                const getVersion = await web.eth.getProtocolVersion();

                expect(typeof version).toStrictEqual('string');
                expect(web3.utils.toHex(version)).toStrictEqual(getVersion);
            }));
        });

        describe('isSyncing | eth_syncing', () => {
            test.skip('returns correct type - Boolean|Object', withWeb3(async (web) => {
                // TODO: This test is failing https://github.com/nearprotocol/near-web3-provider/issues/40
                const keyPair = await nearAPI.KeyPair.fromRandom('ed25519');
                const newAccount = await web._provider.account.createAccount('test.sync', keyPair.getPublicKey(), 2);
                expect(newAccount).toBe('object');

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
    });

    describe('\n---- CONTRACT INTERACTION ----', () => {
        let zombieAddress;

        beforeAll(withWeb3(async (web) => {
            try {
                const deployResult = await web.eth.sendTransaction({
                    from: utils.nearAccountToEvmAddress(ACCOUNT_ID),
                    to: undefined,
                    value: 10,
                    gas: 0,
                    data: zombieCode
                });
                zombieAddress = deployResult.contractAddress;
            } catch(e) {
                console.error('Contract Interaction beforeAll error:', e);
            }
        }));

        describe('getAccounts | eth_accounts', () => {
            test('returns accounts', withWeb3(async (web) => {
                try {
                    const accounts = await web.eth.getAccounts();
                    expect(Array.isArray(accounts)).toBe(true);
                    // TODO: Test accounts
                    // console.log({accounts})
                    // expect(accounts[0]).toStrictEqual('0xCBdA96B3F2B8eb962f97AE50C3852CA976740e2B');
                } catch (e) {
                    console.log(e);
                }
            }));
        });

        describe('getBalance | eth_getBalance', () => {
            test('returns balance', withWeb3(async (web) => {
                let evmAddress = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                let value = 20;

                const balance = await web.eth.getBalance(
                    evmAddress,
                    'latest'
                );
                expect(typeof balance).toBe('string');

                await web.eth.sendTransaction({
                    from: evmAddress,
                    to: evmAddress,
                    value: value,
                    gas: 0
                });
                let newBalance = await web.eth.getBalance(
                    evmAddress,
                    'latest'
                );
                expect(parseInt(newBalance)).toStrictEqual(parseInt(balance) + value);
            }));
        });

        describe('getStorageAt | eth_getStorageAt', () => {
            // TODO: test with a non-0 slot
            test('returns storage position', withWeb3(async (web) => {
                const address = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                const position = 0;
                let storagePosition = await web.eth.getStorageAt(address, position);
                expect(typeof storagePosition).toBe('string');
                expect(storagePosition).toStrictEqual(`0x${'00'.repeat(32)}`);
            }));
        });

        describe('getCode | eth_getCode', () => {
            test('gets code', withWeb3(async (web) => {
                const address = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                const code = await web.eth.getCode(address);
                expect(typeof code).toBe('string');
                expect(code).toStrictEqual('0x');

                const code2 = await web.eth.getCode(zombieAddress);
                expect(typeof code2).toBe('string');
                // TODO: why is code different?
                // expect(code2).toEqual(zombieCode);
                expect(code2).not.toEqual('0x');
            }));
        });

        describe('getTransactionCount | eth_getTransactionCount', () => {
            // TODO: call, make tx, call again to see if incremented
            test('returns transaction count', withWeb3(async (web) => {
                const address = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                const txCount = await web.eth.getTransactionCount(address);

                expect(typeof txCount).toBe('number');
                expect(txCount).toBeGreaterThanOrEqual(0);
            }));

        });

        describe('call | eth_call', () => {
            test('view contract creation', withWeb3(async (web) => {
                let result = await web.eth.call({
                    from: '0xf46215576b7fbd26ff89f803df32c38ee6e7b3e8',
                    data: '0x6080604052600080546001600160a01b0319163317905534801561002257600080fd5b5061016e806100326000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c8063445df0ac146100465780638da5cb5b14610060578063fdacd57614610084575b600080fd5b61004e6100a3565b60408051918252519081900360200190f35b6100686100a9565b604080516001600160a01b039092168252519081900360200190f35b6100a16004803603602081101561009a57600080fd5b50356100b8565b005b60015481565b6000546001600160a01b031681565b6000546001600160a01b031633146101015760405162461bcd60e51b81526004018080602001828103825260338152602001806101076033913960400191505060405180910390fd5b60015556fe546869732066756e6374696f6e206973207265737472696374656420746f2074686520636f6e74726163742773206f776e6572a265627a7a72315820b7e3396b30da5009ea603d5c2bdfd68577b979d5817fbe4fbd7d983f5c04ff3464736f6c634300050f0032'
                });
                expect(result).toStrictEqual(`0xda93d2195fa3d11b5f5eef40e09e46753341b60c`);
            }));

            test('calls view functions', withWeb3(async (web) => {
                // this data blob calls getZombiesByOwner
                // with an argument of an address consisting of 22
                let result = await web.eth.call({
                    from: zombieAddress.toLowerCase(),
                    to: zombieAddress.toLowerCase(),
                    data: '0x4412e1040000000000000000000000002222222222222222222222222222222222222222'
                });
                expect(result).toStrictEqual(`0x${'00'.repeat(31)}20${'00'.repeat(32)}`);
            }));

            test('read-only provider calls view functions', withWeb3View(async (web) => {
                // this data blob calls getZombiesByOwner
                // with an argument of an address consisting of 22
                let result = await web.eth.call({
                    from: zombieAddress.toLowerCase(),
                    to: zombieAddress.toLowerCase(),
                    data: '0x4412e1040000000000000000000000002222222222222222222222222222222222222222'
                });
                expect(result).toStrictEqual(`0x${'00'.repeat(31)}20${'00'.repeat(32)}`);
            }));
        });

        describe('sendTransaction | eth_sendTransaction', () => {
            test('sends the correct balance when deploying code', withWeb3(async (web) => {
                // zombieAddress deployed with val 10 in beforeAll
                const balance = await web.eth.getBalance(
                    zombieAddress,
                    'latest'
                );
                expect(balance).toStrictEqual('10');
            }));

            test('sends value from near account to corresponding evm account', withWeb3(async (web) => {
                const from = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                const value = 10 * (10 ** 18);

                let prevBalance = parseInt(await web.eth.getBalance(from, 'latest'));
                const addNear = await web.eth.sendTransaction({
                    from,
                    to: from,
                    value: value,
                    gas: 0
                });
                let newBalance = parseInt(await web.eth.getBalance(from, 'latest'));

                expect(addNear.to).toStrictEqual(from);
                expect(newBalance).toStrictEqual(prevBalance + value);
            }));

            test('sends the correct balance when simply transferring funds to other evm address', withWeb3(async (web) => {
                const from = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                const to = utils.nearAccountToEvmAddress('random');
                const value = 15 * (10 ** 18);
                await web.eth.sendTransaction({
                    from,
                    to: from,
                    value: value * 2,
                    gas: 0
                });

                let prevFromBalance = parseInt(await web.eth.getBalance(from, 'latest'));
                let prevToBalance = parseInt(await web.eth.getBalance(to, 'latest'));

                const sendResult = await web.eth.sendTransaction({
                    from,
                    to,
                    value,
                    gas: 0
                });

                let newFromBalance = parseInt(await web.eth.getBalance(from, 'latest'));
                let newToBalance = parseInt(await web.eth.getBalance(to, 'latest'));

                expect(sendResult.to).toStrictEqual(to);
                expect(newFromBalance).toStrictEqual(prevFromBalance - value);
                expect(newToBalance).toStrictEqual(prevToBalance + value);
            }));
        });

        test('read-only provider cannot send transaction transferring tokens', withWeb3View(async(webView) => {
            const from = utils.nearAccountToEvmAddress('thisaccountnamedoesntexist');
            const to = utils.nearAccountToEvmAddress('random');
            const value = 19 * (10 ** 18);

            let err;
            try {
                await webView.eth.sendTransaction({
                    from,
                    to,
                    value: value,
                    gas: 0
                });
            } catch (e) {
                err = e;
            }
            expect(err.message).toContain('The provider is read-only and cannot send transactions');
        }));

        describe('retrieveNear | near_retrieveNear', () => {
            let account, value;

            beforeEach(withWeb3(async (web) => {
                account = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                value = 6 * 10 ** 18;
                await web.eth.sendTransaction({
                    from: account,
                    to: account,
                    value: value.toString(),
                    gas: 0
                });
            }));

            test('sends near back to nearAccount if sufficient funds in corresponding evm account', withWeb3(async (web) => {
                let valueRetrieved = value / 2;
                let prevEvmBalance = await web.eth.getBalance(account, 'latest');

                await web.near.retrieveNear({
                    from: account,
                    value: valueRetrieved,
                    to: ACCOUNT_ID,
                    gas: 0
                });

                let newEvmBalance = await web.eth.getBalance(account, 'latest');

                expect(prevEvmBalance - newEvmBalance).toStrictEqual(valueRetrieved);
                // TODO: test that near balances are being modified appropriately
                // let prevNearBalance = (await web._provider.account.getAccountBalance()).total
                // let newNearBalance = (await web._provider.account.getAccountBalance()).total;
                // expect(parseInt(newNearBalance) - parseInt(prevNearBalance)).toBeGreaterThan(0) // failing
            }));

            test('forces capitalized near accountID to lowercase and successfully completes transaction', withWeb3(async (web) => {
                let valueRetrieved = value / 2;
                let prevEvmBalance = await web.eth.getBalance(account, 'latest');

                await web.near.retrieveNear({
                    from: account,
                    value: valueRetrieved,
                    to: 'Test.Near',
                    gas: 0
                });

                let newEvmBalance = await web.eth.getBalance(account, 'latest');

                expect(prevEvmBalance - newEvmBalance).toStrictEqual(valueRetrieved);
            }));

            test('returns error if amount exceeds evm account balance', withWeb3(async (web) => {
                let currentBalance = await web.eth.getBalance(account, 'latest');

                let err;
                try {
                    await web.near.retrieveNear({
                        from: account,
                        value: new bn(currentBalance).mul(new bn(2)).toString(),
                        to: ACCOUNT_ID,
                    });
                } catch (e) {
                    err = JSON.stringify(e);
                }
                expect(err).toContain('InsufficientFunds');
            }));

            test('returns error if near accountID is invalid', withWeb3(async (web) => {
                const invalidAccountID = 'random%%id';

                let err;
                try {
                    await web.near.retrieveNear({
                        from: account,
                        value: value / 2,
                        to: invalidAccountID,
                        gas: 0
                    });
                } catch (e) {
                    err = e.message;
                }
                expect(err).toContain('invalid near accountID:');
            }));
        });

        describe('retrieveNear | near_transferNear', () => {
            let account, value;

            beforeEach(withWeb3(async (web) => {
                account = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                value = 2 * 10 ** 18;
                await web.eth.sendTransaction({
                    from: account,
                    to: account,
                    value: value.toString(),
                    gas: 0
                });
            }));

            test('transfers near to the evm address corresponding to the near accountId', withWeb3(async (web) => {
                let recipientEvm = utils.nearAccountToEvmAddress('randomid.test');

                let fromPrevBalance = await web.eth.getBalance(account, 'latest');
                let toPrevBalance = await web.eth.getBalance(recipientEvm, 'latest');

                await web.near.transferNear({
                    from: account,
                    value: value,
                    to: recipientEvm,
                    gas: 0
                });

                let fromNewBalance = await web.eth.getBalance(account, 'latest');
                let toNewBalance = await web.eth.getBalance(recipientEvm, 'latest');

                expect(fromPrevBalance - fromNewBalance).toStrictEqual(value);
                expect(toNewBalance - toPrevBalance).toStrictEqual(value);

            }));

            test('throws an error if amount exceeds balance', withWeb3(async (web) => {
                let recipientEvm = utils.nearAccountToEvmAddress('randomid.test');
                let balance = await web.eth.getBalance(account, 'latest');

                let err;
                try {
                    await web.near.transferNear({
                        from: account,
                        value: new bn(balance).mul(new bn(2)),
                        to: recipientEvm,
                        gas: 0
                    });
                } catch (e) {
                    err = JSON.stringify(e);
                }
                expect(err).toContain('InsufficientFunds');
            }));
        });

        describe('web3 Contract Abstraction', () => {
            test('can instantiate and run view functions', withWeb3(async (web) => {
                let zombies = new web.eth.Contract(zombieABI, zombieAddress, {
                    from: '0x1941022347348828a24a5ff33c775d6769168119'
                });
                let callRes = await zombies.methods.getZombiesByOwner(`0x${'22'.repeat(20)}`).call();
                expect(callRes).toBeInstanceOf(Array);
                expect(callRes.length).toStrictEqual(0);
            }));

            test('can make transactions', withWeb3(async (web) => {
                let zombies = new web.eth.Contract(zombieABI, zombieAddress, {
                    from: '0x1941022347348828a24a5ff33c775d6769168119'
                });
                let txRes = await zombies.methods.createRandomZombie('george').send({from: web._provider.accountEvmAddress});
                expect(txRes).toBeInstanceOf(Object);
                expect(txRes.from).toStrictEqual(web._provider.accountEvmAddress);

                // Note: this is failing with:
                // Querying call/evm/view failed: wasm execution failed with error: FunctionCallError(EvmError(BadInstruction { instruction: 254 })).
                const evmAddress = web._provider.accountEvmAddress;
                // evmAddress is 0xcbda96b3f2b8eb962f97ae50c3852ca976740e2b
                // but this test will pass if we instead give it the value 0x1941022347348828a24a5ff33c775d6769168119
                const callRes = await zombies.methods.getZombiesByOwner(evmAddress).call();
                expect(callRes).toBeInstanceOf(Array);
                expect(callRes.length).toStrictEqual(1);
            }), 11000);

            test('cannot make transactions with read-only provider', withWeb3View(async (web) => {
                let zombies = new web.eth.Contract(zombieABI, zombieAddress, {
                    from: '0x1941022347348828a24a5ff33c775d6769168119'
                });

                let err;
                try {
                    await zombies.methods.createRandomZombie('george').send({from: web._provider.accountEvmAddress});
                } catch (e) {
                    err = e;
                }
                expect(err).toBeTruthy();
                expect(err.message).toContain('The provider is read-only and cannot send transactions');
            }), 11000);

            test('can deploy', withWeb3(async (web) => {
                let zombies = new web.eth.Contract(zombieABI);
                let result = await zombies
                    .deploy({data: zombieCode})
                    .send({from: web._provider.accountEvmAddress});
                expect(result._address).toBeDefined();
                expect(result._address.length).toStrictEqual(42);
                expect(result._address.slice(0, 2)).toStrictEqual('0x');
            }), 11000);
        });

    });

    describe('\n---- BLOCK & TRANSACTION QUERIES ----', () => {
        let blockHash;
        let blockHeight;
        let transactionHash;
        let txIndex;
        let blockWithTxsHash;
        let blockWithTxsNumber;
        let zombieAddress;
        const value = 10;
        const base58TxHash = 'ByGDjvYxVZDxv69c86tFCFDRnJqK4zvj9uz4QVR4bH4P';

        beforeAll(withWeb3(async (web) => {
            const newBlock = await getLatestBlockInfo(testNearProvider);
            blockHash = newBlock.blockHash;
            blockHeight = newBlock.blockHeight;

            const txResult = await web.eth.sendTransaction({
                from: utils.nearAccountToEvmAddress(ACCOUNT_ID),
                to: undefined,
                value,
                gas: 0,
                data: zombieCode
            });

            zombieAddress = txResult.contractAddress;
            transactionHash = txResult.transactionHash;
            txIndex = txResult.transactionIndex;
            blockWithTxsHash = txResult.blockHash;
            blockWithTxsNumber = txResult.blockNumber;
        }));

        describe('getTransaction | eth_getTransactionByHash', () => {
            test('fails to get non-existent transactions', withWeb3(async(web) => {
                let err;
                try {
                    await web.eth.getTransaction(`${base58TxHash}:${ACCOUNT_ID}`);
                } catch (e) {
                    err = e;
                }
                expect(err).toBeDefined();
            }));

            describe('for contract creation transaction', () => {
                test('has correct parameters', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(transactionHash);
                    expect(tx.blockHash).toStrictEqual(blockWithTxsHash);
                    expect(utils.isHex(tx.blockHash)).toBeTruthy();
                    expect(tx.blockNumber).toStrictEqual(blockWithTxsNumber);
                    expect(tx.transactionIndex).toStrictEqual(txIndex);
                    expect(tx.hash).toStrictEqual(transactionHash);
                    expect(tx.from.toLowerCase()).toStrictEqual(web._provider.accountEvmAddress.toLowerCase());
                    expect(tx.to).toBeNull();
                    expect(tx.input).toStrictEqual(zombieCode);
                    expect(parseInt(tx.value)).toStrictEqual(value);
                }));
            });

            describe('for contract interaction transaction', () => {
                let txHash;
                let encoded_call;
                let txReceipt;

                beforeAll(withWeb3(async (web) => {
                    let zombies = new web.eth.Contract(zombieABI, zombieAddress);
                    txReceipt = await zombies.methods.createRandomZombie('george')
                        .send({from: web._provider.accountEvmAddress});

                    txHash = txReceipt.transactionHash;
                    encoded_call = zombies.methods.createRandomZombie('george').encodeABI();
                }));

                test('has correct parameters', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(txHash);
                    expect(tx.blockHash).toStrictEqual(txReceipt.blockHash);
                    expect(utils.isHex(tx.blockHash)).toBeTruthy();
                    expect(tx.blockNumber).toStrictEqual(txReceipt.blockNumber);
                    expect(tx.transactionIndex).toStrictEqual(txReceipt.transactionIndex);
                    expect(tx.hash).toStrictEqual(txHash);
                    expect(tx.from.toLowerCase()).toStrictEqual(web._provider.accountEvmAddress.toLowerCase());
                    expect(tx.to).toStrictEqual(zombieAddress);
                    expect(tx.input).toStrictEqual(utils.getInputWithLengthPrefix(encoded_call));
                    expect(parseInt(tx.value)).toStrictEqual(0);
                }));
            });

            describe('for simple transfer transactions', () => {
                let addNearReceipt;
                let transferReceipt;
                let to;
                let from;
                let value = 5;

                beforeAll(withWeb3(async (web) => {
                    from = web._provider.accountEvmAddress;
                    to = utils.nearAccountToEvmAddress('random');

                    addNearReceipt = await web.eth.sendTransaction({
                        from,
                        to: from,
                        value: value * 2,
                        gas: 0
                    });

                    transferReceipt = await web.eth.sendTransaction({
                        from,
                        to,
                        value,
                        gas: 0
                    });
                }));

                test('transaction has correct parameters for addNear from near account to evm account', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(addNearReceipt.transactionHash);
                    expect(tx.blockHash).toStrictEqual(addNearReceipt.blockHash);
                    expect(utils.isHex(tx.blockHash)).toBeTruthy();
                    expect(tx.blockNumber).toStrictEqual(addNearReceipt.blockNumber);
                    expect(tx.transactionIndex).toStrictEqual(addNearReceipt.transactionIndex);
                    expect(tx.hash).toStrictEqual(addNearReceipt.transactionHash);
                    expect(tx.from.toLowerCase()).toStrictEqual(from.toLowerCase());
                    expect(tx.to.toLowerCase()).toStrictEqual(from.toLowerCase());
                    expect(tx.input).toStrictEqual('');
                    expect(parseInt(tx.value)).toStrictEqual(value * 2);
                }));

                test('transaction has correct parameters for transfers between evm addrs', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(transferReceipt.transactionHash);
                    expect(tx.blockHash).toStrictEqual(transferReceipt.blockHash);
                    expect(utils.isHex(tx.blockHash)).toBeTruthy();
                    expect(tx.blockNumber).toStrictEqual(transferReceipt.blockNumber);
                    expect(tx.transactionIndex).toStrictEqual(transferReceipt.transactionIndex);
                    expect(tx.hash).toStrictEqual(transferReceipt.transactionHash);
                    expect(tx.from.toLowerCase()).toStrictEqual(from.toLowerCase());
                    expect(tx.to.toLowerCase()).toStrictEqual(to.toLowerCase());
                    expect(tx.input).toStrictEqual('');
                    expect(parseInt(tx.value)).toStrictEqual(value);
                }));
            });
        });

        describe('getBlockNumber | eth_blockNumber', () => {
            test('returns the most recent blockNumber', withWeb3(async (web) => {
                await waitForABlock();
                let blockNumber = await web.eth.getBlockNumber();
                expect(blockNumber).not.toBeNaN();
                expect(blockNumber).toBeGreaterThanOrEqual(blockHeight);
            }));
        });

        describe(`getBlock |
            eth_getBlockByHash,
            eth_getBlockByNumber`, () => {

            test('gets block by hash', withWeb3(async (web) => {
                const block = await web.eth.getBlock(blockHash);

                expect(block.hash).toStrictEqual(blockHash);
                expect(block.number).toStrictEqual(blockHeight);
                expect(Array.isArray(block.transactions)).toBe(true);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0]).toBe('string');
                }
                expect(typeof block.timestamp).toBe('number');
            }));

            test('gets block by hash with full tx objs', withWeb3(async (web) => {
                const block = await web.eth.getBlock(blockHash, true);

                expect(block.hash).toStrictEqual(blockHash);
                expect(block.number).toStrictEqual(blockHeight);
                expect(Array.isArray(block.transactions)).toBe(true);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0] === 'object').toBe(true);
                    expect(typeof block.transactions[0].hash).toBe('string');
                }
            }));

            test('gets block by number', withWeb3(async (web) => {
                const block = await web.eth.getBlock(blockHeight);
                expect(block.hash).toStrictEqual(blockHash);
                expect(block.number).toStrictEqual(blockHeight);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0]).toBe('string');
                }
            }));

            test('gets block by number with full tx objs', withWeb3(async (web) => {
                const block = await web.eth.getBlock(blockHeight, true);

                expect(block.hash).toStrictEqual(blockHash);
                expect(block.number).toStrictEqual(blockHeight);
                expect(Array.isArray(block.transactions)).toBe(true);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0] === 'object').toBe(true);
                    expect(typeof block.transactions[0].hash).toBe('string');
                }
            }));

            test('gets block by string - "latest"', withWeb3(async (web) => {
                const blockString = 'latest';

                await waitForABlock();

                const block = await web.eth.getBlock(blockString);
                expect(block.number).toBeGreaterThan(blockHeight);
                expect(Array.isArray(block.transactions)).toBe(true);
                if (block.transactions.length > 0) {
                    expect(typeof block.transactions[0]).toBe('string');
                }
            }));
        });

        describe(`getBlockTransactionCount |
            eth_getBlockTransactionCountByHash,
            eth_getBlockTransactionCountByNumber`, () => {

            test('gets count by block hash: one tx ', withWeb3(async (web) => {
                const count = await web.eth.getBlockTransactionCount(blockWithTxsHash);
                expect(count).not.toBeNaN();
                expect(typeof count).toBe('number');
                expect(count).toBeGreaterThanOrEqual(1);
            }));

            test('gets count by block number: one tx', withWeb3(async (web) => {
                const count = await web.eth.getBlockTransactionCount(blockWithTxsNumber);
                expect(count).not.toBeNaN();
                expect(typeof count).toBe('number');
                expect(count).toBeGreaterThanOrEqual(1);
            }));

            test('gets count by block hash: empty block', withWeb3(async (web) => {
                const count = await web.eth.getBlockTransactionCount(blockHash);
                expect(count).not.toBeNaN();
                expect(typeof count).toBe('number');
                expect(count).toEqual(0);
            }));

            test('gets count by block number: empty block', withWeb3(async (web) => {
                const count = await web.eth.getBlockTransactionCount(blockHeight);
                expect(count).not.toBeNaN();
                expect(typeof count).toBe('number');
                expect(count).toEqual(0);
            }));
        });

        describe(`getTransactionFromBlock |
            eth_getTransactionByBlockHashAndIndex,
            eth_getTransactionByBlockNumberAndIndex`, () => {

            test('returns transaction from block hash', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock(blockWithTxsHash, txIndex);
                expect(typeof tx).toBe('object');
                expect(typeof tx.hash).toBe('string');
                expect(tx.hash).toStrictEqual(transactionHash);
            }));


            test('returns transaction from block number', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock(blockWithTxsNumber, txIndex);
                expect(typeof tx).toBe('object');
                expect(typeof tx.hash).toBe('string');
                expect(tx.hash).toStrictEqual(transactionHash);
            }));


            test('returns transaction from string - latest', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock('latest', txIndex);
                // NB: We expect this to be null because the latest block will not have a transaction on it.
                expect(tx).toBeNull();
            }));

            // TODO: Blocks get garbage collected.
            // test('returns tx from string - genesis', withWeb3(async (web) => {
            //     const tx = await web.eth.getTransactionFromBlock('earliest', txIndex);
            //     // NB: We expect this to be null because the earliest block will not have a transaction on it.
            //     expect(tx).toBeNull();
            // }));

            test('errors if block does not exist', withWeb3(async (web) => {
                let err;
                try {
                    const notRealBlockHash = utils.base58ToHex('3cdkbRn1hpNLH5Ri6pipy7AEAKJscPD7TCgLFs94nWGB');
                    await web.eth.getTransactionFromBlock(notRealBlockHash, txIndex);
                } catch (e) {
                    err = e;
                }
                expect(err).toBeDefined();
            }));
        });

        describe('getTransactionReceipt | eth_getTransactionReceipt', () => {
            test('gets transaction receipt', withWeb3(async (web) => {
                const txResult = await createEvmTransaction(web);
                const txReceipt = await web.eth.getTransactionReceipt(txResult.transactionHash);

                expect(typeof txResult).toBeTruthy();
                expect(typeof txResult).toStrictEqual('object');
                expect(txResult.transactionHash).toStrictEqual(txReceipt.transactionHash);
            }));

            test('has correct parameters', withWeb3(async (web) => {
                // hardcoded data
                const eventRawData = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000209e105f40198c000000000000000000000000000000000000000000000000000000000000000667656f7267650000000000000000000000000000000000000000000000000000';
                const topics = ['0x88f026aacbbecc90c18411df4b1185fd8d9be2470f1962f192bf84a27d0704b7'];
                const id = 'log_';
                const zombieDNA = '9180992409442700';
                const zombieName = 'george';

                // deploy zombie code
                const deployResult = await web.eth.sendTransaction({
                    from: utils.nearAccountToEvmAddress(ACCOUNT_ID),
                    to: undefined,
                    value: 10,
                    gas: 0,
                    data: zombieCode
                });
                let zombieAddress = deployResult.contractAddress;
                let zombies = new web.eth.Contract(zombieABI, zombieAddress);
                let txReceipt = await zombies.methods.createRandomZombie(zombieName).send({from: web._provider.accountEvmAddress});

                expect(txReceipt.from).toStrictEqual(web._provider.accountEvmAddress);
                expect(txReceipt.to).toStrictEqual(zombieAddress.toLowerCase());
                expect(txReceipt.events.NewZombie.blockNumber).toStrictEqual(txReceipt.blockNumber);
                expect(txReceipt.events.NewZombie.blockHash).toStrictEqual(txReceipt.blockHash);
                expect(txReceipt.events.NewZombie.address).toStrictEqual(zombieAddress);
                expect(txReceipt.events.NewZombie.signature).toStrictEqual(topics[0]);
                expect(txReceipt.events.NewZombie.id).toContain(id);
                expect(txReceipt.events.NewZombie.transactionHash).toStrictEqual(txReceipt.transactionHash);
                expect(txReceipt.events.NewZombie.raw.data).toStrictEqual(eventRawData);
                expect(txReceipt.events.NewZombie.raw.topics).toStrictEqual(topics);
                expect(txReceipt.events.NewZombie.event).toStrictEqual('NewZombie');
                expect(txReceipt.events.NewZombie.returnValues.name).toStrictEqual(zombieName);
                expect(txReceipt.events.NewZombie.returnValues.dna).toStrictEqual(zombieDNA);
                expect(txReceipt.events.NewZombie.returnValues.zombieId).toStrictEqual('0');

            }));

            test('errors if not a real txhash', withWeb3(async (web) => {
                const errorType = '[-32602]';

                let err;
                try {
                    const badHash = 'whatsuppppp:hello';
                    await web.eth.getTransactionReceipt(badHash);
                } catch (e) {
                    err = e;
                }
                expect(err).toBeTruthy();
                expect(err.message).toContain(errorType);
            }));

            test('errors if hash does not exist', withWeb3(async (web) => {
                const notRealHash = '9Y9SUcuLRX1afHsyocHiryPQvqAujrJqugy4WgjfXGiw';
                const account = 'test.near';

                let err;
                try {
                    await web.eth.getTransactionReceipt(notRealHash + ':' + account);
                } catch (e) {
                    err = e;
                }
                expect(err).toBeTruthy();
                expect(err.message).toEqual(`[-32000] Server error: Transaction ${notRealHash} doesn't exist`);
            }));
        });
    });

    describe('\n---- EXTENDED UTILITY FUNCTIONS ----', () => {
        describe('web3.utils.hexToBase58', () => {
            test('returns the correct output', withWeb3(async (web) => {
                const hex = '0xcbda96b3f2b8eb962f97ae50c3852ca976740e2b';
                const expectedBase58 = '3qirLQdXAeug59YuXYk1eocA4BJ2';
                expect(web.utils.hexToBase58(hex)).toStrictEqual(expectedBase58);
            }));
        });

        describe('web3.utils.base58ToHex', () => {
            test('returns the correct output', withWeb3(async (web) => {
                const base58 = '3qirLQdXAeug59YuXYk1eocA4BJ2';
                const expectedHex = '0xcbda96b3f2b8eb962f97ae50c3852ca976740e2b';
                expect(web.utils.base58ToHex(base58)).toStrictEqual(expectedHex);
            }));
        });
    });
});