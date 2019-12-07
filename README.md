# near-web3-provider

NEAR Protocol Web3 provider.
Use it to connect your Ethereum frontend or Truffle to NEAR Protocol.

## Install

```bash
npm install near-web3-provider
```

## Requirements

Node > 11.0

## General Usage

You can use this provider wherever a Web3 provider is needed.

```javascript
const NearProvider = require("near-web3-provider");

const web = new Web3();
web.setProvider(new NearProvider("<url to NEAR RPC>"));
web.eth.net.isListening();
```

## Using in Truffle

Add to your `truffle-config.json`:

```javascript
const NearProvider = require("near-web3-provider");

module.exports = {
  networks: {
    near: {
        network_id: "99",
        provider: function() {
            return new NearProvider("https://rpc.nearprotocol.com")
        },
    }
  }
}
```
