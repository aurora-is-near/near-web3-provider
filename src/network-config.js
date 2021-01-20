const consts = require('./consts');

const getNetworkConfig = function getNetworkConfig(networkId) {
    switch (networkId) {
        case 'mainnet':
            return {
                nodeUrl: 'https://rpc.mainnet.near.org',
                networkId: 'mainnet',
                evmAccountId: 'evm',
                walletUrl: 'https://wallet.near.org',
                explorerUrl: 'https://explorer.near.org',
                version: consts.NEAR_NET_VERSION
            };
        case 'testnet':
            return {
                nodeUrl: 'https://rpc.testnet.near.org',
                networkId: 'default',
                evmAccountId: 'evm',
                walletUrl: 'https://wallet.testnet.near.org',
                explorerUrl: 'https://explorer.testnet.near.org',
                version: consts.NEAR_NET_VERSION_TEST
            };
        case 'betanet':
            return {
                nodeUrl: 'https://rpc.betanet.near.org',
                networkId: 'betanet',
                evmAccountId: 'evm',
                walletUrl: 'https://wallet.betanet.near.org',
                explorerUrl: 'https://explorer.betanet.near.org',
                version: consts.NEAR_NET_VERSION_BETANET
            };
        case 'local':
            return {
                nodeUrl: 'http://127.0.0.1:3030',
                networkId: 'local',
                evmAccountId: 'evm',
                walletUrl: 'http://127.0.0.1:4000',
                explorerUrl: 'http://127.0.0.1:3019',
                version: consts.NEAR_NET_VERSION_TEST
            };
        case 'test':
            return {
                networkId: 'test',
                nodeUrl: 'http://localhost:3030',
                keyPath: '../test/keys/test.near.json',
                version: consts.NEAR_NET_VERSION_TEST
            };
        default:
            throw Error(`Unconfigured environment '${networkId}'. Please see project README.`);
    }
}

module.exports = {
    getNetworkConfig
}
