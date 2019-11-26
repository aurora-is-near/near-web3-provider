const nearlib = require("nearlib");

class NearProvider {
    constructor(url) {
        this.url = url;
        this.provider = new nearlib.providers.JsonRpcProvider(url);
    }

    // Maps ethereum RPC into NEAR RPC requests and remaps back the responses.
    async ethNearRpc(method, params) {
        switch (method) {
            case "net_listening": {
                console.warn("1");
                const status = await this.provider.status();
                return true;
            }
            case "eth_blockNumber": {
                const status = await this.provider.status();
                return '0x' + status["sync_info"]["latest_block_height"].toString(16);
            }
            case "eth_gasPrice": {
                // TODO: query gas price.
                return '0x100';
            }
        }
        return "unknown";
    }

    sendAsync(payload, cb) {
        console.warn("Async");
        console.warn(payload);
        this.ethNearRpc(payload["method"], payload["params"]).then((result) => {
            console.warn("Result", result);
            // TODO: handle errors and all the jazz here.
            cb(null, {
                id: payload["id"],
                jsonrpc: "2.0",
                result
            });
        });
    }

    send(payload) {
        console.warn("Sync");
        console.warn(arguments);
        return 0;
    }

    getAddress(idx) {
        console.warn("getAddress");
        console.warn(idx);
    }

    getAddresses() {
        return [];
    }
}

module.exports = NearProvider;
