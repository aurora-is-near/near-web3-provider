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
const NEARProvider = require("near-web3-provider");

const web = new Web3();
web.setProvider(new NEARProvider("<url to NEAR RPC>"));
web.eth.net.isListening();
```
