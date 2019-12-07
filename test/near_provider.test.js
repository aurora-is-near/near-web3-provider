const NearProvider = require('../index');
const web3 = require('web3');

const withWeb3 = (fn) => {
    const web = new web3();
    web.setProvider(new NearProvider('https://rpc.nearprotocol.com/'));
    return () => fn(web);
};

// test('isListening', withWeb3(async (web) => {
//     await web.eth.net.isListening();
// }));

// test('blockNumber', withWeb3(async (web) => {
//     let blockNumber = await web.eth.getBlockNumber();
//     expect(blockNumber).toBeGreaterThan(0);
// }));

test('sendTx', withWeb3(async (web) => {
    const rawTransaction = {
        "from": "illia",
        "to": "alex",
        "value": web3.utils.toHex(web3.utils.toWei("0.001", "ether")),
        "gas": 200000,
        "chainId": 3
    };
    let pk = '0x6ba33b3f7997c2bf63d82f3baa1a8069014a59fa1f554af3266aa85afee9d0a9';
    pk = new Buffer(pk, 'hex');
    const address = '0xFb4d271F3056aAF8Bcf8aeB00b5cb4B6C02c7368';

    signedTx = await web.eth.accounts.signTransaction(rawTransaction, rawTransaction.from);
    console.warn(signedTx);
}));