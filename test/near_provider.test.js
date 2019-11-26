const NearProvider = require('../index');
const web3 = require('web3');

const withWeb3 = (fn) => {
    const web = new web3();
    web.setProvider(new NearProvider('https://rpc.nearprotocol.com/'));
    return () => fn(web);
};

test('isListening', withWeb3(async (web) => {
    await web.eth.net.isListening();
}));

test('blockNumber', withWeb3(async (web) => {
    let blockNumber = await web.eth.getBlockNumber();
    expect(blockNumber).toBeGreaterThan(0);
}));

// test('sendTx', withWeb3(async (web) => {

// }));