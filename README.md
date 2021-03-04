# *NOTE: THIS IS ALPHA SOFTWARE*

# near-web3-provider

NEAR Protocol Web3 provider.
Use it to connect your Ethereum frontend or Truffle to NEAR Protocol.

## Requirements

**Node > 11.0**

## Install

```bash
$ npm install near-web3-provider
```

## Running Tests

Tests require [running a local `nearcore`](https://docs.nearprotocol.com/docs/local-setup/local-dev-testnet).

### Setup and Run NEARCore

Install Rustup:
```
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Add wasm target to your toolchain:
```
$ rustup target add wasm32-unknown-unknown
```

Install and run NEARCore using Docker:
```
$ git clone https://github.com/nearprotocol/nearcore
$ cd nearcore
$ cargo build -p neard --release
$ ./target/release/neard --home=~/.near/local init
$ ./target/release/neard --home=~/.near/local run
```

Build test environment:
```bash

# grant executable access to build.sh if not yet done
chmod +x test/build.sh

# build solidity contracts
# necessary on first ever test run then update build per contract changes
cd test && ./build.sh && cd ..
```

Run tests
```
$ npm run test
```

Tests currently take ~50 seconds to run.

## Developing

The web3 Provider also needs to be tested against the `near-evm` contract.

Follow the testing instructions on the [near-evm repo](https://github.com/near/near-evm#testing).

If you're developing against an in-flux contract, make sure to build the wasm code from `near-evm` and update the wasm code for the provider: `test/artifacts/near_evm.wasm`.

## General Usage

You can use this provider wherever a Web3 provider is needed.

```javascript
const { NearProvider, nearlib, nearWeb3Extensions } = require('near-web3-provider');

const nearNetworkId = '<local, default, test, etc>'; // default is 'default'
const accountId = '<account id to use for tx>';
const keyStore = new nearlib.keyStores.<one of keyStores>;

const web = new Web3();
web.extend(nearWeb3Extensions(web)) // extend web3 to include customized near methods
web.setProvider(new NearProvider("<url to NEAR RPC>", keyStore, accountId, nearNetworkId));
web.eth.net.isListening();
```

## Using in Truffle

Add to your `truffle-config.js`:

```javascript
// Import NearProvider and nearlib
const { NearProvider, nearlib } = require('near-web3-provider');

// Specify which NEAR network to use
const nearNetworkId = '<local, default, test, etc>';

// If developing against a local node, use http://localhost:3030
const url = 'https://rpc.nearprotocol.com';

// Specify where to store keys
const keyDir = 'neardev';

// Use standard near-shell structure for storing keys. See note below for other options.
const keyStore = new nearlib.keyStores.UnencryptedFileSystemKeyStore(keyDir);

// Account ID
const accountId = 'test.account';

module.exports = {
  networks: {
    near: {
        network_id: "99",
        skipDryRun: true,
        provider: function() {
            return new NearProvider(url, keyStore, accountId, nearNetworkId)
        },
    }
  }
}
```
See [key store documentation](https://github.com/nearprotocol/nearlib/blob/master/lib/key_stores/index.d.ts) for other options.

## Differences from Ethereum providers

NEAR Protocol is a sharded, proof-of-stake blockchain. Keeping that in mind, some Ethereum concepts are naturally not shared with NEAR; for example, there is no concept of uncle blocks, pending blocks, or block difficulty.

As a sharded blockchain, the structure of NEAR blocks is also different. In Ethereum, blocks have transactions. In NEAR, blocks have chunks, and chunks have transactions.

`near-web3-provider` has been adapted to follow the [Ethereum JSON RPC API](https://eth.wiki/json-rpc/API) and its [`web3` equivalents](https://web3js.readthedocs.io/en/v1.2.4/web3-eth.html#) as closely as possible. Where there are no equivalents, empty values have been passed through. Other return values have been adapted to account for the difference in block structure (for example, the root of the transaction trie comes from a chunk rather than a block).

Mining, hashrates, `ssh,` and `db` methods are not supported.

### Limitations and Differences

* [Methods](https://github.com/ethereum/wiki/wiki/json-rpc#the-default-block-parameter) that have an extra default block parameter will function as `latest`, regardless of the actual argument. This is a Near RPC limitation.

* `eth_call` does not support `from` or `value` arguments. This is a Near RPC limitation.

* `eth_estimateGas` will always return `0x0`. Near RPC does not seem to support
  gas estimation for calls.

* Some fields in Ethereum data structures do not have a direct correspondence to Near data structures, therefore these fields are unimplemented or unreliable. Always consult implementation in near_to_eth_objects.js. Examples include:
  * The tx receipts `status` field is always `0x1`, regardless of the success of the transaction.
  * `transactionIndex` is constant, and not reliable.

* Some calls, like `eth_getTransactionByBlockHashAndIndex` have no sensible correspondence to Near block structure.

* Near doesn't keep track of nonces for contracts which is a required feature for the evm. Therefore both an evm nonce and near nonce exist for each account. `eth_getTransactionCount` will return a reference to the evm nonce. All other nonce fields in the web3-near-provider reference the near nonce.
    * evm nonce: nonce used for address calculation in the next EVM contract deployment from this EVM account
    * near nonce: number of all near transactions (including evm transactions) executed by account

## API Overview

Unless specified, NearProvider returns the values specified in the web3 documentation for each method.

If a method has no direct translation, an `Unsupported method` error is returned.

### Hash Conversions and Equivalents

Near uses `base58` while Ethereum uses `Keccak`. This necessitates the need to convert between the two. With the exception of transaction hashes, Near hashes are converted to Ethereum-compatible hashes when using `web3`.

### Important Format Changes

* `blockHash` - a block hash is the hash equivalent of a Near block hash
  * denoted in `hex` within the context of the near-web3-provider
  * denoted in `base58` within the context of the rest of the near protocol

* `transactionHash` - a transaction hash is the combination of a Near transaction hash (in `base58`) concatenated with the accountId of the transaction's sender, and separated by `:`
  * `<base58TxHash>:<senderAccountId>` within the context of the near-web3-provider
  * `<senderAccountId>:<base58TxHash>` within the context of the rest of the near protocol

* `gas` - Gas is denominated in yoctoNEAR

* `value` - Transaction values/amounts are denominated in yoctoNEAR

* `to`, `from`, `address` - Addresses are the EVM hash of a Near AccountId

---

## API - Custom Near Methods

### web3.near.retrieveNear
```
web3.near.retrieveNear([transactionObject])
```
Transfers yoctoNEAR from evmAccount out of the evm to near account.

#### Parameters

1. `Object` - the transaction object to send:

   * `to` - `String`: near accountId to receive yoctoNEAR
   * `value` - `Number|String|BN|BigNumber`: amount of yoctoNEAR to attach
   * `gas` - `Number`: amount of gas to use for the transaction in yoctoNEAR

#### Returns

Returns the `transactionHash` of the transaction: `<base58TxHash>:<accountId>`

---

### web3.near.transferNear
```
web3.near.transferNear([transactionObject])
```
Transfers yoctoNEAR from sending evmAccount to the evmAccount corresponding to near accountId recipient (`to`)

#### Parameters

1. `Object` - the transaction object to send:

   * `to` - `String`: near accountId to receive yoctoNEAR to their corresponding evm address
   * `value` - `Number|String|BN|BigNumber`: amount of yoctoNEAR to attach
   * `gas` - `Number`: amount of gas to use for the transaction in yoctoNEAR

#### Returns

Returns the `transactionHash` of the transaction: `<base58TxHash>:<accountId>`

---

## API - Custom Near Utility Functions

### web3.utils.hexToBase58
```
web3.utils.hexToBase58(hexVal)
```
Converts hex value into base58 value. `blockHash` is represented in hex in the context of `web3.eth` functionality but represented within the near protocol as `base58`

#### Parameters

1. `String` `hex` - valid with or without `0x` prepended

#### Returns

Returns `String` `base58`

---

### web3.utils.hexToBase58
```
web3.utils.base58ToHex(base58Val)
```
Converts base58 value into hex value. `blockHash` is represented in hex in the context of `web3.eth` functionality but represented within the near protocol as `base58`

#### Parameters

1. `String` `base58`

#### Returns

Returns `String` `hex` - prepended with `0x`

---

## API - Unsupported Methods

* `web3.eth.getCoinbase`
* `web3.eth.isMining`
* `web3.eth.getHashrate`
* `web3.eth.getBlockUncleCount`
* `web3.eth.getUncle`
* `web3.eth.getPendingTransactions`
* `web3.eth.sign`
* `web3.eth.estimateGas`
* `web3.eth.getPastLogs`
* `web3.eth.getWork`
* `web3.eth.submitWork`
* `web3.eth.requestAccounts`
* `web3.eth.getChainId`
* `web3.eth.getNodeInfo`
* `web3.eth.getProof`

---

## API - Supported Methods

### web3.eth.getProtocolVersion
```
web3.eth.getProtocolVersion([callback])
```
Returns the Near protocol version of the node.

#### Returns
`Promise` returns `String`: the protocol version.

#### Differences | Limitations
* Returns the Near protocol version instead of the Ethereum protocol version

---

### web3.eth.isSyncing
```
web3.eth.isSyncing
```
Checks if the node is currently syncing and returns either a syncing object, or false.

#### Returns
`Promise` returns `Object|Boolean` - a syncing object, or `false`.

* `startingBlock` - Unsupported, returns `0x0`
* `currentBlock` - Returns the latest block height
* `highestBlock` - Returns the latest block height
* `knownStates` - Unsupported, returns `0x0`
* `pulledStates` - Unsupported, returns `0x0`

#### Differences | Limitations
* This will almost always return `false`
* If a syncing object does return, the values are generally not useful

---

### web3.eth.getGasPrice
```
web3.eth.getGasPrice()
```

Returns the current gas price in yoctoNEAR.

#### Returns
`Promise` returns `String` - Number string of the current gas price in yoctoNEAR.

#### Differences | Limitations
* The gas price is returned in yoctoNEAR instead of wei
* At the moment, the gas price is determined from the most recent block. web3 typically determines the gas price by the last few blocks median gas price.

---

### web3.eth.getAccounts
```
web3.eth.getAccounts()
```

Returns a list of accounts the node controls.

#### Returns
`Promise` returns `Array` - An array of addresses controlled by node.

#### Differences | Limitations
* Addresses are the EVM hash of a Near AccountId

---

### web3.eth.getBlockNumber
```
web3.eth.getBlockNumber()
```

Returns the current block number

#### Returns
`Promise` returns `Number` - The number of the most recent block.

---

### web3.eth.getBalance

```
web3.eth.getBalance(address)
```

Returns the balance of an address.

#### Parameters
1. `String` `address` - The address to get the balance of. This is the EVM address equivalent of a Near AccountId

#### Returns
`Promise` returns `String` - The current balance for the given address in yoctoNEAR.

#### Differences | Limitations
* Due to Near RPC limitations, the balance of the address will always be from the latest block.
* Address is the EVM hash of a Near AccountId

---

### web3.eth.getStorageAt

```
web3.eth.getStorageAt(address, position)
```

Get the storage at a specific position of an address.

#### Parameters
1. `String` `address` - The address to get the storage from. This is the EVM address equivalent of a Near AccountId
2. `Number|String|BN|BigNumber` `position` - the index position of the storage

#### Returns
`Promise` returns `String` - The value in storage at the given position.

#### Differences | Limitations
* Due to Near RPC limitations, the balance of the address will always be from the latest block.
* Address is the EVM hash of a Near AccountId

---

### web3.eth.getCode

```
web3.eth.getCode(address)
```

Get the code at a specific address

#### Parameters
1. `String` `address` - The address to get the code from.

#### Returns
`Promise` returns `String` - The data at given address `address`.

#### Differences | Limitations
* Due to Near RPC limitations, the balance of the address will always be from the latest block.
* Address is the EVM hash of a Near AccountId

-------------------------

### web3.eth.getBlock

```
web3.eth.getBlock(blockHashOrBlockNumber [, returnTransactionObjects])
```

Returns a block matching the block number or block hash

#### Parameters
1. `String|Number|BN|BigNumber` - The block number or block hash. Or the string `'genesis'`, `'latest'`, `'earliest'`, or `'pending'`
2. `Boolean` - (optional, default `false`) If specified `true`, the returned block will contain all transactions as objects. By default it is `false` so, there is no need to explicitly specify false. And, if `false` it will only contain the transaction hashes.

#### Returns

`Promise` returns `Object` - The block object
* `number` - The block number
* `hash` - Hash equivalent of the base58 Near block hash
* `parentHash` - Hash equivalent of the base58 Near block's parent block hash
* `nonce` - Always returns `null`. This is typically the hash of the generated proof-of-work. There is no equivalent concept in Near.
* `transactionsRoot` - Always returns `0x0000...`. Since transactions are on chunks and chunks are on block, there is no equivalent of a transaction trie of the block
* `size` - Returns the weight of the block
* `gasLimit` - The maximum gas allowed in this block. Returned in yoctoNEAR
* `gasUsed` - The total used gas by all chunks in this block. A chunk may have a transaction, but that transaction may be processed in a different chunk.
* `timestamp` - The unix timestamp for when the block was collated
* `transactions` - Array of transaction objects, or the 32 byte transaction hashes equivalent of the base58 Near transaction hashes.
* `sha3Uncles` - Unsupported, undefined/null value returned
* `logsBloom` - Unsupported, undefined/null value returned
* `stateRoot` - Unsupported, undefined/null value returned
* `miner` - Unsupported, undefined/null value returned
* `difficulty` - Unsupported, undefined/null value returned
* `totalDifficulty` - Unsupported, undefined/null value returned
* `extraData` - Unsupported, undefined/null value returned
* `uncles` - Unsupported, undefined/null value returned

#### Differences | Limitations
* Passing through `'genesis'` or `'earliest'` will return block 0
* Passing through `'latest'` or `'pending'` will return the latest block. There is no concept of pending blocks.
* See [Important Format Changes](###Important%20Format%20Changes) for information on `hash`, `gas`, `transactions`
---

### web3.eth.getBlockTransactionCount

```
web3.eth.getBlockTransactionCount(blockHashOrBlockNumber)
```

Returns the number of transactions in a given block.

#### Parameters
1. `{String|Number|BN|BigNumber}` - The block number or block hash. Or the string `'genesis'`, `'latest'`, `'earliest'`, or `'pending'`

#### Returns
`Promise` returns `Number` - The number of transactions in the given block.

### Differences | Limitations
* Blocks have chunks and chunks have transactions; all the transactions are collected from a block's chunks and counted. Conceptually this is the same thing, but note that transactions do not actually reside in blocks.

---

### web3.eth.getTransaction

```
web3.eth.getTransaction(transactionHash)
```

Returns a transaction matching the given transaction hash.

#### Parameters
1. `String` `transactionHash` - the transaction hash

#### Returns

`Promise` returns `Object` - A transaction object

* `hash` - Hash of the transaction `<nearTxHash>:<accountId>` (transaction's sender's accountId)
* `nonce` - The total number of near transactions made by the sender prior to this one
* `blockHash` - hash equivalent of the block where this transaction was in (represented in hex instead of near's base58 format)
* `blockNumber` - Block number where this transaction was in
* `transactionIndex` - integer of the transactions index position in the block
* `from` - EVM Address of the sender
* `to` - EVM address of the receiver
* `value` - Value transferred in yoctoNEAR
* `gasPrice` - Gas price set by the block in yoctoNEAR
* `gas` - Gas consumed by the sender in yoctoNEAR
* `input` - tx data, encoded contract call or deployed bytecode

#### Differences | Limitations

* Due to the Near protocol, getting a transaction's status requires knowing both the transaction hash _and_ the Near AccountId of the transaction's signer. To allow for this, transaction hashes in NearProvider are the base58 transaction hashes concatenated with the `signer_id` of the transaction, and separated with a `:`.

  Example:
    ```
    // A Near transaction hash (base58)
    const nearTxHash = 'ByGDjvYxVZDxv69c86tFCFDRnJqK4zvj9uz4QVR4bH4P';

    // A Near AccountId. In particular, the AccountId of the transaction's signer
    const signerId = 'test.near'

    // Concatenate and separate with ':'
    const txHash = `${nearTxHash}:${signerId};

    console.log(txHash);

    // ByGDjvYxVZDxv69c86tFCFDRnJqK4zvj9uz4QVR4bH4P:test.near
    ```
* See [Important Format Changes](###Important%20Format%20Changes) for additional information.

---

### web3.eth.getTransactionFromBlock

```
web3.eth.getTransactionFromBlock(hashStringOrNumber, indexNumber)
```

Returns a transaction based on a block hash or number and the transaction's index position.

#### Parameters
1. `{String|Number|BN|BigNumber}` `hashStringOrNumber` The block number or block hash. Or the string `'genesis'`, `'latest'`, `'earliest'`, or `'pending'`
2. `{Number}` `indexNumber` - The transaction's index position

#### Returns
`Promise` returns `Object` - A transaction object. See [web3.eth.getTransaction](###web3.eth.getTransaction).

#### Differences | Limitations
See [web3.eth.getTransaction](###web3.eth.getTransaction).

---

### web3.eth.getTransactionReceipt

```
web3.eth.getTransactionReceipt(hash)
```

Returns the receipt of a transaction by transaction hash.

#### Parameters
1. `String` `transactionHash` - the transaction hash. See [web3.eth.getTransaction](###web3.eth.getTransaction####Differences).

#### Returns

`Promise` returns `Object` - A transaction receipt object

* `status` - Returns `true` if the transaction was successful, `false` if the EVM reverted the transaction
* `blockHash` Hash of the block where this transaction was in.
* `blockNumber` - Block number where this transaction was in.
* `transactionHash` - Hash of the transaction.
* `transactionIndex` - Integer of the transactions index position in the block.
* `from` - Address of the sender.
* `to` - Address of the receiver. null when its a contract creation transaction.
* `contractAddress` - The contract address created, if the transaction was a contract creation, otherwise null.
* `cumulativeGasUsed` - The total amount of gas used when this transaction was executed in the block.
* `gasUsed`- The amount of gas used by this specific transaction alone.
* `logs` - Array of log objects, which this transaction generated.

#### Differences | Limitations
See [web3.eth.getTransaction](###web3.eth.getTransaction####Differences).

---

### web3.eth.getTransactionCount

```
web3.eth.getTransactionCount(address)
```

Get the numbers of transactions sent from this address.

#### Parameters
1. `String` `address` - The address to get the numbers of transactions from. Address is the EVM address of a Near AccountId

#### Returns
`Promise` returns `Number` - The total number of evm transactions sent from the given address

#### Differences | Limitations
* Specifically, returns the nonce of evm transactions sent from the address. Near will only return the total transactions; selecting a block is not supported
* The return value refers to the total number of evm transactions not including near transactions outside the evm. All other transaction count nonces refer to total near transactions (which include evm transcations)

---

### web3.eth.sendTransaction

```js
web3.eth.sendTransaction(transactionObject)
```

Sends a transaction to the network.

#### Parameters

1. `Object` - the transaction object to send:

   * `to` - `String`: EVM destination address
   * `value` - `Number|String|BN|BigNumber`: amount of yoctoNEAR to attach
   * `gas` - `Number`: amount of gas to use for the transaction in yoctoNEAR
   * `data` - `String`: the encoded call data

#### Returns

Returns the `transactionHash` of the transaction: `<base58TxHash>:<accountId>`

#### Differences | Limitations
* The sender is the default accountId. At this time, another account cannot be specified.
* All other optional properties on the transaction object are unsupported

---

### web3.eth.sendSignedTransaction

Unsupported at the moment, always returns `0x0`.

---

### web3.eth.call (in progress)

```
web3.eth.signTransaction(transactionObject)
```

Executes a new message call immediately without creating a transaction on the block chain.

#### Parameters

1. `Object` - A transaction object, see [web3.eth.sendTransaction](###web3.eth.sendTransaction), with the difference that only the `to` field is required.

#### Returns
`Promise` returns `String`: The returned data of the call, e.g. a smart contract functions return value.

#### Differences | Limitations
* Due to Near RPC limitations, this will always be called on the latest block.

---

## To Do
- [ ] Update hardcoded `transactionIndex`
- [x] Make sure all errors are handled
- [ ] Expose `utils.nearAccountToEvmAddress`, otherwise users will not be able to pass through the EVM Address equivalent
- [ ] Expose conversion utils like `base58ToHex`, `hexToBase58`
- [ ] Add documentation about accessing provider methods (point to Near docs, explain relevant methods)
