const web3 = require('web3');
const { NearProvider, nearAPI, utils } = require('../src/index');

const NEAR_ENV = process.env.NEAR_ENV || 'test';
const config = require('./config')[NEAR_ENV];
const ACCOUNT = require(config.keyPath);
const ACCOUNT_ID = ACCOUNT.account_id;
const ACCOUNT_KEY = ACCOUNT.secret_key;
const ACCOUNT_KEYPAIR = nearAPI.utils.KeyPair.fromString(ACCOUNT_KEY);

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
    return () => fn(web);
};

describe('\n---- KEY MANAGEMENT ----', () => {
    test('signTypedData', withWeb3(async (web3) => {
        const params = [utils.nearAccountToEvmAddress(ACCOUNT_ID), JSON.parse('{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"AddUserRequest":[{"name":"handle","type":"bytes16"},{"name":"nonce","type":"bytes32"}]},"domain":{"name":"User Factory","version":"1","chainId":"98","verifyingContract":"0x805B9c39D919Dec9eCfF8c10C91479B4d68dA2F8"},"primaryType":"AddUserRequest","message":{"handle":"0x7573657248616e646c6531","nonce":"0xb28a876f70ba058235f107c1572570125abe7201231e2a80217010ea39eab209"}}')];
        let sig = await new Promise((resolve, reject) => web3.currentProvider.sendAsync({
            method: 'eth_signTypedData',
            params,
            from: utils.nearAccountToEvmAddress(ACCOUNT_ID)
        }, function (err, result) {
            if (err) {
                reject(err);
            } else if (result.error) {
                reject(result.error);
            } else {
                resolve(result.result);
            }
        }));
        expect(sig).toEqual('0x0b67b4ec07370be7cc0a1a54b07058519bbf444ca89ffef9e36116fa40fe91688683e0e09cfa137fd6ac640a000cb50e693a0986aa039b2bd097edc8ef23da0e');
    }));
});
