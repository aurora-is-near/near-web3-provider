const getNetworkConfig = function getNetworkConfig(networkId) {
    switch (networkId) {
        case 'mainnet':
            return {
                nodeUrl: 'https://rpc.mainnet.near.org',
                networkId: 'mainnet',
                evmAccountId: 'evm',
                walletUrl: 'https://wallet.near.org',
                explorerUrl: 'https://explorer.near.org',
            };
        case 'testnet':
            return {
                nodeUrl: 'https://rpc.testnet.near.org',
                networkId: 'default',
                evmAccountId: 'evm',
                walletUrl: 'https://wallet.testnet.near.org',
                explorerUrl: 'https://explorer.testnet.near.org',
            };
        case 'betanet':
            return {
                nodeUrl: 'https://rpc.betanet.near.org',
                networkId: 'betanet',
                evmAccountId: 'evm',
                walletUrl: 'https://wallet.testnet.near.org',
                explorerUrl: 'https://explorer.testnet.near.org',
            };
        case 'local':
            return {
                nodeUrl: 'http://127.0.0.1:3030',
                networkId: 'local',
                evmAccountId: 'evm',
                walletUrl: 'http://127.0.0.1:4000',
                explorerUrl: 'http://127.0.0.1:3019',
            };
        default:
            throw Error(`Unconfigured environment '${networkId}'. Please see project README.`);
    }
}

module.exports = {
    getNetworkConfig
}
