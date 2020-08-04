/**
 * These tests default to running a local NEAR node. nearcore must be
 * running at the same folder level.
 */

const fs = require('fs');
const web3 = require('web3');
const bn = web3.utils.BN
const nearlib = require('near-api-js');
const utils = require('../src/utils');
const { NearProvider, nearWeb3Extensions } = require('../src/index');

// TODO: update nearEvmFile frequently when near_evm work is being done
const nearEvmFile = './artifacts/near_evm.wasm';
const zombieCodeFile = './artifacts/zombieAttack.bin';
const zombieABIFile = './artifacts/zombieAttack.abi';

// see NearProvider constructor, src/index.js
const NEAR_ENV = process.env.NEAR_ENV || 'local';

const config = require('./config')[NEAR_ENV];
const NODE_URL = config.nodeUrl;
const ACCOUNT = require(config.keyPath);
// Main/Sender Account. Default is test.near
const ACCOUNT_ID = ACCOUNT.account_id;
const ACCOUNT_KEY = ACCOUNT.secret_key;
const ACCOUNT_KEYPAIR = nearlib.utils.KeyPair.fromString(ACCOUNT_KEY);

const testNearProvider = new nearlib.providers.JsonRpcProvider(NODE_URL);

console.log(`-----------------------
Running tests on ${NEAR_ENV} network
NODE_URL: ${NODE_URL}
Account Id: ${ACCOUNT_ID}
Public Key: ${ACCOUNT.public_key}
-----------------------`);

const withWeb3 = (fn) => {
    const web = new web3();
    const keyStore = new nearlib.keyStores.InMemoryKeyStore();
    keyStore.setKey('test', ACCOUNT_ID, ACCOUNT_KEYPAIR);

    web.setProvider(new NearProvider(NODE_URL, keyStore, ACCOUNT_ID));
    web.extend(nearWeb3Extensions(web))
    return () => fn(web);
};

/**
 * Deploys evm contract
 */
async function deployContract(web) {
    const evmAccountId = 'evm';
    const evmCode = fs.readFileSync(nearEvmFile).toString('hex');
    const evmBytecode = Uint8Array.from(Buffer.from(evmCode, 'hex'));
    const keyPair = createKeyPair();

    console.log(`Deploying contract on NEAR_ENV: "${NEAR_ENV}"`);

    try {
        await web._provider.keyStore.setKey(NEAR_ENV, evmAccountId, keyPair);
    } catch (e) {
        throw new Error('Error setting key', e);
    }

    try {
        // Minimum amount required to cover storage - LackBalanceForState
        const startingBalance = BigInt(99999999999999999999999999999999);
        const contract = await web._provider.account.createAndDeployContract(
            evmAccountId,
            keyPair.getPublicKey(),
            evmBytecode,
            startingBalance);  // NEAR value
        console.log('deployed EVM contract', contract);
        return true;
    } catch (e) {
        if (e.type === 'ActionError::AccountAlreadyExists') {
            console.log('EVM already deployed');
            return true;
        } else {
            console.log('EVM deploy error', e);
            return false;
        }
    }
}

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
        const txResult = await web.eth.sendTransaction({
            from: '00'.repeat(20),
            to: '00'.repeat(20),
            value: 0,
            gas: 0,
            data: '0x00'
        });

        return txResult;
    } catch (e) {
        return e;
    }
}

describe('\n---- PROVIDER ----', () => {
    beforeAll(withWeb3(async (web) => {
        try {
            const exists = await accountExists(web, 'evm');
            if (exists) {
                return true;
            }
            return await deployContract(web);
        } catch (e) {
            console.error('Error in beforeAll', e);
        }
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
                const keyPair = await nearlib.KeyPair.fromRandom('ed25519');
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
        let zombieABI;
        let zombieCode;
        let zombieAddress;

        beforeAll(withWeb3(async (web) => {
            try {
                zombieCode = fs.readFileSync(zombieCodeFile).toString();
                const deployResult = await web.eth.sendTransaction({
                    from: `0x${'00'.repeat(20)}`,
                    to: undefined,
                    value: 10,
                    gas: 0,
                    data: `0x${zombieCode}`
                });
                zombieAddress = deployResult.contractAddress;
                zombieABI = JSON.parse(fs.readFileSync(zombieABIFile).toString());

                console.log({ zombieAddress })
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

                const addNear = await web.eth.sendTransaction({
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
            // TODO: deploy a contract and test
            test('gets code', withWeb3(async (web) => {
                const address = utils.nearAccountToEvmAddress(ACCOUNT_ID);
                const code = await web.eth.getCode(address);
                expect(typeof code).toBe('string');
                expect(code).toStrictEqual('0x');

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
            test('calls view functions', withWeb3(async (web) => {
                // this data blob calls getZombiesByOwner
                // with an argument of an address consisting of 22
                let result = await web.eth.call({
                    to: zombieAddress,
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
                expect(balance).toStrictEqual("10");
            }));

            test('sends value from near account to corresponding evm account', withWeb3(async (web) => {
                const from = utils.nearAccountToEvmAddress(ACCOUNT_ID)
                const value = 10 * (10 ** 18)

                let prevBalance = parseInt(await web.eth.getBalance(from, 'latest'))
                const addNear = await web.eth.sendTransaction({
                    from,
                    to: from,
                    value: value,
                    gas: 0
                });
                let newBalance = parseInt(await web.eth.getBalance(from, 'latest'))

                expect(addNear.to).toStrictEqual(from)
                expect(newBalance).toStrictEqual(prevBalance + value);
            }));

            test('sends the correct balance when simply transferring funds to other evm address', withWeb3(async (web) => {
                const from = utils.nearAccountToEvmAddress(ACCOUNT_ID)
                const to = utils.nearAccountToEvmAddress("random")
                const value = 15 * (10 ** 18)
                const addNear = await web.eth.sendTransaction({
                    from,
                    to: from,
                    value: value * 2,
                    gas: 0
                });

                let prevFromBalance = parseInt(await web.eth.getBalance(from, 'latest'))
                let prevToBalance = parseInt(await web.eth.getBalance(to, 'latest'))

                const sendResult = await web.eth.sendTransaction({
                    from,
                    to,
                    value,
                    gas: 0
                });

                let newFromBalance = parseInt(await web.eth.getBalance(from, 'latest'))
                let newToBalance = parseInt(await web.eth.getBalance(to, 'latest'))

                expect(sendResult.to).toStrictEqual(to)
                expect(newFromBalance).toStrictEqual(prevFromBalance - value);
                expect(newToBalance).toStrictEqual(prevToBalance + value);
            }));
        });

        describe('retrieveNear | near_retrieveNear', () => {
            let account, value, firstNearBalance

            beforeEach(withWeb3(async (web) => {
                account = utils.nearAccountToEvmAddress(ACCOUNT_ID)
                value = 6 * 10 ** 18
                await web.eth.sendTransaction({
                    from: account,
                    to: account,
                    value: value.toString(),
                    gas: 0
                });
            }));

            test('sends near back to nearAccount if sufficient funds in corresponding evm account', withWeb3(async (web) => {
                let valueRetrieved = value / 2;
                let numprevBal = await web.eth.getBalance(account, 'latest')
                let prevEvmBalance = await web.eth.getBalance(account, 'latest')
                let prevNearBalance = (await web._provider.account.getAccountBalance()).total

                let retrieveNear = await web.near.retrieveNear({
                    from: account,
                    value: valueRetrieved,
                    to: ACCOUNT_ID,
                    gas: 0
                })

                let newEvmBalance = await web.eth.getBalance(account, 'latest')
                let newNearBalance = (await web._provider.account.getAccountBalance()).total

                expect(prevEvmBalance - newEvmBalance).toStrictEqual(valueRetrieved)
                // TODO: test that near balances are being modified appropriately
                // expect(parseInt(newNearBalance) - parseInt(prevNearBalance)).toBeGreaterThan(0) // failing
            }));

            test('forces capitalized near accountID to lowercase and successfully completes transaction', withWeb3(async (web) => {
                let valueRetrieved = value / 2;
                let numprevBal = await web.eth.getBalance(account, 'latest')
                let prevEvmBalance = await web.eth.getBalance(account, 'latest')
                let prevNearBalance = (await web._provider.account.getAccountBalance()).total

                let retrieveNear = await web.near.retrieveNear({
                    from: account,
                    value: valueRetrieved,
                    to: "Test.Near",
                    gas: 0
                })

                let newEvmBalance = await web.eth.getBalance(account, 'latest')
                let newNearBalance = (await web._provider.account.getAccountBalance()).total

                expect(prevEvmBalance - newEvmBalance).toStrictEqual(valueRetrieved)
            }));

            test('returns error if amount exceeds evm account balance', withWeb3(async (web) => {
                let currentBalance = await web.eth.getBalance(account, 'latest')

                let err;
                try {
                    await web.near.retrieveNear({
                        from: account,
                        value: currentBalance * 2,
                        to: ACCOUNT_ID,
                        gas: 0
                    })
                } catch (e) {
                    err = e.message;
                }
                expect(err).toContain("insufficient funds")
            }));

            test('returns error if near accountID is invalid', withWeb3(async (web) => {
                const invalidAccountID = "random%%id";

                let err;
                try {
                    await web.near.retrieveNear({
                        from: account,
                        value: value / 2,
                        to: invalidAccountID,
                        gas: 0
                    })
                } catch (e) {
                    err = e.message;
                }
                expect(err).toContain("invalid near accountID:")
            }));
        })

        describe('retrieveNear | near_transferNear', () => {
            let account, value, firstNearBalance

            beforeEach(withWeb3(async (web) => {
                account = utils.nearAccountToEvmAddress(ACCOUNT_ID)
                value = 2 * 10 ** 18
                await web.eth.sendTransaction({
                    from: account,
                    to: account,
                    value: value.toString(),
                    gas: 0
                });
            }));

            test('transfers near to the evm address corresponding to the near accountId', withWeb3(async (web) => {
                let recipient = 'randomid.test'
                let recipientEvm = utils.nearAccountToEvmAddress(recipient)

                let fromPrevBalance = await web.eth.getBalance(account, 'latest')
                let toPrevBalance = await web.eth.getBalance(recipientEvm, 'latest')

                let transferNear = await web.near.transferNear({
                    from: account,
                    value: value,
                    to: recipient,
                    gas: 0
                })

                let fromNewBalance = await web.eth.getBalance(account, 'latest')
                let toNewBalance = await web.eth.getBalance(recipientEvm, 'latest')

                expect(fromPrevBalance - fromNewBalance).toStrictEqual(value)
                expect(toNewBalance - toPrevBalance).toStrictEqual(value)

            }));

            test('throws an error if amount exceeds balance', withWeb3(async (web) => {
                let recipient = 'randomid.test'
                let recipientEvm = utils.nearAccountToEvmAddress(recipient)
                let balance = await web.eth.getBalance(account, 'latest');

                let err
                try {
                    await web.near.transferNear({
                        from: account,
                        value: balance * 2,
                        to: recipient,
                        gas: 0
                    });
                } catch (e) {
                    err = e.message
                }
                expect(err).toContain('underflow during sub_balance')
            }))
        });

        describe('web3 Contract Abstraction', () => {
            test('can instantiate and run view functions', withWeb3(async (web) => {
                let zombies = new web.eth.Contract(zombieABI, zombieAddress);
                let callRes = await zombies.methods.getZombiesByOwner(`0x${'22'.repeat(20)}`).call();
                expect(callRes).toBeInstanceOf(Array);
                expect(callRes.length).toStrictEqual(0);
            }));

            test('can make transactions', withWeb3(async (web) => {
                let zombies = new web.eth.Contract(zombieABI, zombieAddress);
                let txRes = await zombies.methods.createRandomZombie('george')
                    .send({from: web._provider.accountEvmAddress});
                expect(txRes).toBeInstanceOf(Object);
                expect(txRes.from).toStrictEqual(web._provider.accountEvmAddress);

                let callRes = await zombies.methods.getZombiesByOwner(web._provider.accountEvmAddress).call();
                expect(callRes).toBeInstanceOf(Array);
                expect(callRes.length).toStrictEqual(1);
                expect(callRes[0]).toStrictEqual('0');
            }), 11000);

            test('can deploy', withWeb3(async (web) => {
                let zombies = new web.eth.Contract(zombieABI);
                let result = await zombies
                    .deploy({data: `0x${zombieCode}`})
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
        let txResult;
        let transactionHash;
        let txIndex;
        let blockWithTxsHash;
        let blockWithTxsNumber;
        let zombieCode
        let zombieAddress
        const value = 10
        const base58TxHash = 'ByGDjvYxVZDxv69c86tFCFDRnJqK4zvj9uz4QVR4bH4P';

        beforeAll(withWeb3(async (web) => {
            const newBlock = await getLatestBlockInfo();
            blockHash = newBlock.blockHash;
            blockHeight = newBlock.blockHeight;

            zombieCode = fs.readFileSync(zombieCodeFile).toString();
            const txResult = await web.eth.sendTransaction({
                from: `0x${'00'.repeat(20)}`,
                to: undefined,
                value,
                gas: 0,
                data: `0x${zombieCode}`
            });

            zombieAddress = txResult.contractAddress;
            transactionHash = txResult.transactionHash;
            txIndex = txResult.transactionIndex;
            blockWithTxsHash = txResult.blockHash;
            blockWithTxsNumber = txResult.blockNumber;
        }));

        describe('getTransaction | eth_getTransactionByHash', () => {
            test('fails to get non-existant transactions', withWeb3(async(web) => {
                let err;
                try {
                    await web.eth.getTransaction(`${base58TxHash}:${ACCOUNT_ID}`);
                } catch (e) {
                    err = e;
                }
                expect(err).toBeDefined();
            }));

            describe('for contract creation transaction', () => {
                test('has corrent parameters', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(transactionHash);
                    expect(tx.blockHash).toStrictEqual(blockWithTxsHash)
                    expect(utils.isHex(tx.blockHash)).toBeTruthy()
                    expect(tx.blockNumber).toStrictEqual(blockWithTxsNumber)
                    expect(tx.transactionIndex).toStrictEqual(txIndex)
                    expect(tx.hash).toStrictEqual(transactionHash)
                    expect(tx.from.toLowerCase()).toStrictEqual(web._provider.accountEvmAddress.toLowerCase())
                    expect(tx.to).toBeNull()
                    expect(tx.input).toStrictEqual("0x" + zombieCode)
                    expect(parseInt(tx.value)).toStrictEqual(value)
                }));
            });

            describe('for contract interaction transaction', () => {
                let txHash
                let encoded_call
                let txReceipt

                beforeAll(withWeb3(async (web) => {
                    let zombieABI = JSON.parse(fs.readFileSync(zombieABIFile).toString());
                    let zombies = new web.eth.Contract(zombieABI, zombieAddress);
                    txReceipt = await zombies.methods.createRandomZombie('george')
                        .send({from: web._provider.accountEvmAddress});

                    txHash = txReceipt.transactionHash
                    encoded_call = zombies.methods.createRandomZombie('george').encodeABI()
                }))

                test('has correct parameters', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(txHash);
                    expect(tx.blockHash).toStrictEqual(txReceipt.blockHash)
                    expect(utils.isHex(tx.blockHash)).toBeTruthy()
                    expect(tx.blockNumber).toStrictEqual(txReceipt.blockNumber)
                    expect(tx.transactionIndex).toStrictEqual(txReceipt.transactionIndex)
                    expect(tx.hash).toStrictEqual(txHash)
                    expect(tx.from.toLowerCase()).toStrictEqual(web._provider.accountEvmAddress.toLowerCase())
                    expect(tx.to).toStrictEqual(zombieAddress)
                    expect(tx.input).toStrictEqual(encoded_call)
                    expect(parseInt(tx.value)).toStrictEqual(0)
                }));
            });

            describe('for simple transfer transactions', () => {
                let addNearReceipt
                let transferReceipt
                let to
                let from
                let value = 5

                beforeAll(withWeb3(async (web) => {
                    from = web._provider.accountEvmAddress;
                    to = utils.nearAccountToEvmAddress("random")

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
                }))

                test('transaction has correct parameters for addNear from near account to evm account', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(addNearReceipt.transactionHash);
                    expect(tx.blockHash).toStrictEqual(addNearReceipt.blockHash)
                    expect(utils.isHex(tx.blockHash)).toBeTruthy()
                    expect(tx.blockNumber).toStrictEqual(addNearReceipt.blockNumber)
                    expect(tx.transactionIndex).toStrictEqual(addNearReceipt.transactionIndex)
                    expect(tx.hash).toStrictEqual(addNearReceipt.transactionHash)
                    expect(tx.from.toLowerCase()).toStrictEqual(from.toLowerCase())
                    expect(tx.to.toLowerCase()).toStrictEqual(from.toLowerCase())
                    expect(tx.input).toStrictEqual('')
                    expect(parseInt(tx.value)).toStrictEqual(value * 2)
                }))

                test('transaction has correct parameters for transfers between evm addrs', withWeb3(async(web) => {
                    // TODO: test nonce: see issue #27 https://github.com/nearprotocol/near-web3-provider/issues/27
                    const tx = await web.eth.getTransaction(transferReceipt.transactionHash);
                    expect(tx.blockHash).toStrictEqual(transferReceipt.blockHash)
                    expect(utils.isHex(tx.blockHash)).toBeTruthy()
                    expect(tx.blockNumber).toStrictEqual(transferReceipt.blockNumber)
                    expect(tx.transactionIndex).toStrictEqual(transferReceipt.transactionIndex)
                    expect(tx.hash).toStrictEqual(transferReceipt.transactionHash)
                    expect(tx.from.toLowerCase()).toStrictEqual(from.toLowerCase())
                    expect(tx.to.toLowerCase()).toStrictEqual(to.toLowerCase())
                    expect(tx.input).toStrictEqual('')
                    expect(parseInt(tx.value)).toStrictEqual(value)
                }))
            })
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

            test('returns tx from string - genesis', withWeb3(async (web) => {
                const tx = await web.eth.getTransactionFromBlock('earliest', txIndex);
                // NB: We expect this to be null because the latest block will not have a transaction on it.
                expect(tx).toBeNull();
            }));

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

            test('errors if not a real txhash', withWeb3(async (web) => {
                const errorType = "[-32602]";

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
                const hex = "0xcbda96b3f2b8eb962f97ae50c3852ca976740e2b"
                const expectedBase58 = "3qirLQdXAeug59YuXYk1eocA4BJ2"
                expect(web.utils.hexToBase58(hex)).toStrictEqual(expectedBase58)
            }));
        });

        describe('web3.utils.base58ToHex', () => {
            test('returns the correct output', withWeb3(async (web) => {
                const base58 = "3qirLQdXAeug59YuXYk1eocA4BJ2"
                const expectedHex = "0xcbda96b3f2b8eb962f97ae50c3852ca976740e2b"
                expect(web.utils.base58ToHex(base58)).toStrictEqual(expectedHex)
            }));
        });
    });
});

/**
 * Helpers
 */
function createKeyPair () {
    return nearlib.utils.KeyPair.fromString(ACCOUNT_KEY);
}

async function getLatestBlockInfo () {
    const { sync_info } = await testNearProvider.status();
    const { latest_block_hash, latest_block_height } = sync_info;
    const block = {
        blockHash: utils.base58ToHex(latest_block_hash),
        blockHeight: latest_block_height
    };

    return block;
}

async function waitForABlock () {
    return await new Promise((r) => setTimeout(r, 1000));
}
