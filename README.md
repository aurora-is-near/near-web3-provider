# *NOTE: THIS IS ALPHA SOFTWARE*

# near-web3-provider

NEAR Protocol Web3 provider.
Use it to connect your Ethereum frontend or Truffle to NEAR Protocol.

## Install

```bash
npm install near-web3-provider
```

## Requirements

**Node > 11.0**

## General Usage

You can use this provider wherever a Web3 provider is needed.

```javascript
const { NearProvider, nearlib } = require('near-web3-provider');

const nearNetworkId = '<local, default, test, etc>'; // default is 'default'
const accountId = '<account id to use for tx>';
const keyStore = new nearlib.keyStores.<one of keyStores>;

const web = new Web3();
web.setProvider(new NearProvider("<url to NEAR RPC>", keyStore, accountId, nearNetworkId));
web.eth.net.isListening();
```

## Using in Truffle

Add to your `truffle-config.json`:

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

`near-web3-provider` has been adapted to follow the [Ethereum JSON RPC API](https://github.com/ethereum/wiki/wiki/json-rpc) and its [`web3` equivalents](https://web3js.readthedocs.io/en/v1.2.4/web3-eth.html#) as closely as possible. Where there are no equivalents, empty values have been passed through. Other return values have been adapted to account for the difference in block structure (for example, the root of the transaction trie comes from a chunk rather than a block).

Mining, hashrates, `ssh,` and `db` methods are not supported.


### Limitations

* [Any call](https://github.com/ethereum/wiki/wiki/json-rpc#the-default-block-parameter) that has an extra default block parameter will function as `latest`, regardless of the actual argument. This is a Near RPC limitation.
* `eth_call` does not support `from` or `value` arguments. This is a Near RPC
  limitation.
* `eth_estimateGas` will always return `0x0`. Near RPC does not seem to support
  gas estimation for calls.
* Many fields in Ethereum data structures do not have a direct correspondance
  to Near data structures. Some attributes of transaction and block objects
  will be unreliable.
* Some fields are just unimplemented. For example, tx receipts currently always
  have a 0x1 status, regardless of the success of the transaction.
* If a method has no direct translation, an `Unsupported method` error is returned.

## API

Unless specified, NearProvider returns the values specified in the web3 documentation for each method.

---

### web3.eth.isSyncing

Returns either a syncing object, or `false`.

#### Differences
* This will almost always return `false`
* `knownStates` and `pulledStates` are always 0

---

### web3.eth.getGasPrice

Returns the current gas price in yoctoNEAR.

#### Differences
* The gas price is returned in yoctoNEAR instead of wei
* At the moment, the gas price is determined from the most recent block. web3 typically determines the gas price by the last few blocks median gas price.

---

### web3.eth.getAccounts

Returns a list of accounts the node controls.

#### Differences
* Addresses are the EVM hashes of a Near AccountId

---

### web3.eth.getBlockNumber

Returns the current block number

---

### web3.eth.getBalance

```
web3.eth.getBalance(address)
```

Returns the balance of an address.

#### Parameters
1. `{String}` `address` - The address to get the balance of. This is the EVM address equivalent of a Near AccountId

#### Differences
* Due to Near RPC limitations, the balance of the address will always be from the latest block.

---

### web3.eth.getStorageAt

```
web3.eth.getStorageAt(address, position)
```

Get the storage at a specific position of an address.

#### Parameters
1. `{String}` `address` - The address to get the storage from. This is the EVM address equivalent of a Near AccountId
2. `{Number|String|BN|BigNumber}` `position` - the index position of the storage

#### Differences
* Due to Near RPC limitations, the balance of the address will always be from the latest block.

---

### web3.eth.getCode

```
web3.eth.getCode(address)
```

Get the code at a specific address

#### Parameters
1. `{String}` `address` - The address to get the code from.

#### Differences
* Due to Near RPC limitations, the balance of the address will always be from the latest block.

-------------------------

### web3.eth.getBlock

```
web3.eth.getBlock(blockHashOrBlockNumber [, returnTransactionObjects])
```

Returns a block matching the block number or block hash

#### Parameters
1. `{String|Number|BN|BigNumber}` - The block number or block hash. Or the string `'genesis'`, `'latest'`, `'earliest'`, or `'pending'`
2. `{Boolean}` - (optional, default `false`) If specified `true`, the returned block will contain all transactions as objects. By default it is `false` so, there is no need to explictly specify false. And, if `false` it will only contain the transaction hashes.

#### Differences
* Passing through `'genesis'` or `'earliest'` will return block 0
* Passing through `'latest'` or `'pending'` will return the latest block. There is no concept of pending blocks.

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

---

### web3.eth.getBlockTransactionCount

```
web3.eth.getBlockTransactionCount(blockHashOrBlockNumber)
```

Returns the number of transactions in a given block

#### Parameters
1. `{String|Number|BN|BigNumber}` - The block number or block hash. Or the string `'genesis'`, `'latest'`, `'earliest'`, or `'pending'`

---

### web3.eth.getTransaction

```
web3.eth.getTransaction(transactionHash)
```

Returns a transaction matching the given transaction hash.

#### Parameters
1. `{String}` `transactionHash` - the transaction hash

#### Differences

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

#### Returns

`Promise` returns `Object` - A transaction object

* `hash` - Hash of the transaction `<nearTxHash>:<accountId>` (transaction's sender's accountId)
* `nonce` - The number of transactions made by the sender prior to this one
* `blockHash` - hash equivalent of the block where this transaction was in.
* `blockNumber` - Block number where this transaction was in
* `transactionIndex` - integer of the transactions index position in the block.
* `from` - EVM Address of the sender
* `to` - EVM address of the receiver
* `value` - Value transfered in yoctoNEAR
* `gasPrice` - Gas price set by the block in yoctoNEAR
* `gas` - Gas consumed by the sender in yoctoNEAR
* `input` - Unsupported, null value provided

---

### web3.eth.getTransactionFromBlock

```
`web3.eth.getTransactionFromBlock(hashStringOrNumber, indexNumber)
```

Returns a transaction based on a block hash or number and the transaction's index position.

#### Parameters
1. `{String|Number|BN|BigNumber}` `hashStringOrNumber` The block number or block hash. Or the string `'genesis'`, `'latest'`, `'earliest'`, or `'pending'`
2. `{Number}` `indexNumber` - The transaction's index position

#### Returns
`Promise` returns `Object` - A transaction object. See [web3.eth.getTransaction](###web3.eth.getTransaction).

#### Differences
See [web3.eth.getTransaction](###web3.eth.getTransaction).

---

### web3.eth.getTransactionReceipt

```
web3.eth.getTransactionReceipt(hash)
```

Returns the receipt of a transaction by transaction hash.

#### Parameters
1. `{String}` `transactionHash` - the transaction hash. See [web3.eth.getTransaction](###web3.eth.getTransaction####Differences).

#### Returns

`Promise` returns `Object` - A transaction receipt object

* `status` - Always returns
blockHash 32 Bytes - String: Hash of the block where this transaction was in.
blockNumber - Number: Block number where this transaction was in.
transactionHash 32 Bytes - String: Hash of the transaction.
transactionIndex- Number: Integer of the transactions index position in the block.
from - String: Address of the sender.
to - String: Address of the receiver. null when its a contract creation transaction.
contractAddress - String: The contract address created, if the transaction was a contract creation, otherwise null.
cumulativeGasUsed - Number: The total amount of gas used when this transaction was executed in the block.
gasUsed- Number: The amount of gas used by this specific transaction alone.
logs - Array: Array of log objects, which this transaction generated.

#### Differences
See [web3.eth.getTransaction](###web3.eth.getTransaction####Differences).

---

### web3.eth.getTransactionCount

```
```

Description

#### Parameters

#### Differences

---

### web3.eth.sendTransaction

```
```

Description

#### Parameters

#### Differences

---

### web3.eth.sendSignedTransaction

```
```

Description

#### Parameters

#### Differences

---

### web3.eth.call

```
```

Description

#### Parameters

#### Differences

---

## Development

### ETH JSON-RPC Datatypes

See [JSON-RPC Wiki](https://github.com/ethereum/wiki/wiki/json-rpc#hex-value-encoding) for additional details.

All data should be hex encoded either as a **QUANTITY** or **UNFORMATTED DATA**, with the exception of **TAG** parameters for the following methods:

* `eth_getBalance`
* `eth_getCode`
* `eth_getTransactionCount`
* `eth_getStorageAt`
* `eth_call`

`{Quantity}` - integers, numbers. encoded as hex, prefix with "0x", in the most compact representation with the exception of zero "0x0" (e.g. no leading zeros)

`{UnformattedData}` - byte arrays, account addresses, hashes, bytecode arrays. encoded as hex, prefix with "0x", two hex digits per byte

`{Tag}` - enum string. Almost always refers to the block height: 'genesis', 'latest', 'earliest', or 'pending'

------------------------------------------

### NEAR Provider

See [JSON-RPC-PROVIDER.js](https://github.com/nearprotocol/nearlib/blob/master/lib/providers/json-rpc-provider.js)

`this.nearProvider` has the following methods:

- block
- query
- sendJsonRpc
- sendTransaction
- status
- chunk
- getNetwork  // Can't call this method. Get method unfound
- tx

All of them, except for `getNetwork`, use `sendJsonRpc` internally.

#### `status`
Returns: `Promise<NodeStatusResult>`

Use: `this.nearProvider.status()`

```typescript
{
  chain_id: string;
  rpc_addr: string;
  sync_info: SyncInfo {
    latest_block_hash: string;
    latest_block_height: number;
    latest_block_time: string;
    latest_state_root: string;
    syncing: boolean;
  },
  validators: string[];
}
```

#### `block`
Can pass in height or hash.

Returns:  `Promise<BlockResult>`

Use: `this.nearProvider.block('GR4SfjKvcyobdaQjEKwfJ3nPAawraJfuzv2LvJ9Dgj3W')`

Result:
```
{
    "jsonrpc": "2.0",
    "result": {
        "author": "test.near",
        "header": {
            "height": 200,
            "epoch_id": "3P9esaeouqspDKGNbpctQQpUJSmQWW8wvNK2ZRuRz9sM",
            "next_epoch_id": "J4cdcT1YgrXR3oL5aydQ5YdZB1RU12ZMvh6nXN7hwcEY",
            "hash": "gKo96eh3FWMHZDjnhyGfwsWzgdy1gqk2zkCKBbNVKA2",
            "prev_hash": "Bsq4o4jj23yyPrcrn7Pfg9ViW1qFSJiZUsyG2MTB99R",
            "prev_state_root": "2ZBSXHB2Ns978Nkn8Y6xM29e2oUQ3UUcM3fLJRyH3Nmg",
            "chunk_receipts_root": "9ETNjrt6MkwTgSVMMbpukfxRshSD1avBUUa4R4NuqwHv",
            "chunk_headers_root": "5apuFWLzqV6FzWaswbfwGfr3kM9EKrgCFbU2rLeB4ugp",
            "chunk_tx_root": "7tkzFg8RHBmMw1ncRJZCCZAizgq4rwCftTKYLce8RU8t",
            "outcome_root": "7tkzFg8RHBmMw1ncRJZCCZAizgq4rwCftTKYLce8RU8t",
            "chunks_included": 1,
            "challenges_root": "11111111111111111111111111111111",
            "timestamp": 1580148379676946000,
            "total_weight": "48558810001000000000",
            "score": "48329319001000000000",
            "validator_proposals": [],
            "chunk_mask": [
                true
            ],
            "gas_price": "0",
            "rent_paid": "0",
            "validator_reward": "0",
            "total_supply": "2050000585045717755487124441863319",
            "challenges_result": [],
            "last_quorum_pre_vote": "Bsq4o4jj23yyPrcrn7Pfg9ViW1qFSJiZUsyG2MTB99R",
            "last_quorum_pre_commit": "UrbEyXhfR79xcbgm2fjUWY9FYV9y8Kq8v97gcY5CUtP",
            "next_bp_hash": "5pLJp76bJLZUJb4EMJ26eniVXs6hfSxYaGoN1pNzMRbP",
            "approvals": [
                [
                    "test.near",
                    "Bsq4o4jj23yyPrcrn7Pfg9ViW1qFSJiZUsyG2MTB99R",
                    "DinZ61U9SyNuma3k7BHGMytbPE6YcYdUGVrjBGu4a6Rw",
                    "ed25519:5JcH6p2XrkQ3qARtJhrt2YTKfE79C4sKFHYR3mzeZZiyARAG1EnRMbfY6DuH9Yq4cGBtvd9BHAwpuLgnxnTEW4hw"
                ]
            ],
            "signature": "ed25519:zWjveBubFGgQ8g9YTrm53oQgRG3MmQgqHKEjP1LEFBVoMLh9maCb3EmwhkPR5EkJr9a5PASUZX2k6s6RtmD1f8K"
        },
        "chunks": [
            {
                "chunk_hash": "xJ9JPyon4FcgwgR1mtw6uca3pSCFKGNUxoXqFJGKwHX",
                "prev_block_hash": "Bsq4o4jj23yyPrcrn7Pfg9ViW1qFSJiZUsyG2MTB99R",
                "outcome_root": "11111111111111111111111111111111",
                "prev_state_root": "Ack57j2N2DY61wwaxvVqsxg9wCbzvz9CKyJ7ThVmEa9B",
                "encoded_merkle_root": "D7vyy5n5oKyZUBEWbj4VdyRktH4ZzBx1JnDMDaS8sDAG",
                "encoded_length": 8,
                "height_created": 200,
                "height_included": 200,
                "shard_id": 0,
                "gas_used": 0,
                "gas_limit": 1000000000000000,
                "rent_paid": "0",
                "validator_reward": "0",
                "balance_burnt": "0",
                "outgoing_receipts_root": "H4Rd6SGeEBTbxkitsCdzfu9xL9HtZ2eHoPCQXUeZ6bW4",
                "tx_root": "11111111111111111111111111111111",
                "validator_proposals": [],
                "signature": "ed25519:ZMKngxCT1D58NF7yEb5zrbNBKZTVi4T6EtewmUwvdg44a9HMqSpPjXwH6os2EZupgMektZhKbAMiQ2sEpqgLUGs"
            }
        ]
    }
}
```

`this.nearProvider.sendJsonRpc('method', { params: [] })`

## Order of Doing Anything on the NEAR platform
1. Establish a connection
2. Establish authentication aka Create an account
   1. All transactions on the network must be signed by a valid NEAR account, no exceptions

`node-fetch`
A path-relative URL (/file/under/root)

#### `query`

`query(path: string, data: bytes)`: queries information in the state machine / database. Where path can be:

`account/<account_id>` - returns view of account information
```
await this.nearProvider.query('account/bobblehead', '')

// returns
{
  amount: '10000000902566790513495899',
  block_height: 1075115,
  code_hash: '11111111111111111111111111111111',
  locked: '0',
  storage_paid_at: 1073873,
  storage_usage: 387
}
```

`access_key/<account_id>` - returns all access keys for given account.
```
await this.nearProvider.query('access_key/bobblehead', '')

// returns
{
  block_height: 1075138,
  keys: [
    {
      access_key: {
        nonce: 0,
        permission: 'FullAccess'
      },
      public_key: 'ed25519:3HYEby4caWr8WjqWr7BCNNQZodRWu9SiY8hxQWkDcuLb'
    },
    {
      access_key: {
        nonce: 3,
        permission: { FunctionCall: [Object] }
      },
      public_key: 'ed25519:3jKYS46fruMcxiGrT13bjbJ2uSLTj2CpGK5YBgUZqPKV'
    },
    {
      access_key: {
        nonce: 3,
        permission: 'FullAccess'
      },
      public_key: 'ed25519:8GLrqwhsjUYqE7J7CyVni5FjY8Ls8WfvRXiXf9m6m8Y6'
    }
  ]
}
```

`access_key/<account_id>/<public_key>` - returns details about access key for given account with this public key. If there is no such access key, returns nothing.
```
const query = await this.nearProvider.query('access_key/bobblehead/ed25519:3jKYS46fruMcxiGrT13bjbJ2uSLTj2CpGK5YBgUZqPKV', '')
// returns
{
  block_height: 1075403,
  nonce: 3,
  permission: {
    FunctionCall: {
      allowance: '99901254745459870000',
      method_names: [],
      receiver_id: 'studio-4jpg4qvj5'
    }
  }
}

const query = await this.nearProvider.query('access_key/bobblehead/ed25519:8GLrqwhsjUYqE7J7CyVni5FjY8Ls8WfvRXiXf9m6m8Y6', '')
// returns
{
  block_height: 1075507,
  nonce: 3,
  permission: 'FullAccess'
}
```

`contract/<account_id>` - returns full state of the contract (might be expensive if contract has large state).
```
const query = await this.nearProvider.query('contract/bobblehead', '')

// returns
{
  block_height: 1075579,
  values: {}
}
```

`call/<account_id>/<method name>` - calls <method name> in contract <account_id> as view function with data as parameters.
[evm-contract](https://github.com/summa-tx/near-evm/blob/master/src/lib.rs)
```
const contractId = 'EVM-CONTRACT-ID'
const query = await this.nearProvider.query(`call/${contractId}`/${methodName})

```

```
const account = new nearlib.Account(this.connection, 'bobblehead')
const details = await account.getAccountDetails()
// details result
{
  authorizedApps: [{
    contractId: 'studio-4jpg4qvj5',
    amount: '99901254745459870000',
    publicKey: 'ed25519:3jKYS46fruMcxiGrT13bjbJ2uSLTj2CpGK5YBgUZqPKV'
  }],
  transactions: []
}
```

#### Transactions and Chunks

  ```js
  const account = new nearlib.Account(this.connection, 'liau')
  const details = await account.getAccountDetails();

  // returns
  { authorizedApps: [], transactions: [] }

  ```

  ```js
  const account = new nearlib.Account(this.connection, 'liau')
  const details = await account.state();

  // returns
  {
    amount: '10000000972015914912415159',
    block_height: 1131560,
    code_hash: '11111111111111111111111111111111',
    locked: '0',
    storage_paid_at: 1131308,
    storage_usage: 264
  }
  ```

#### Chunks

Blocks contain chunks, and chunks contain transactions.

Chunk: `29QUPr3jsmT5JccVjFCBbPnoYMct2P8p3G9ntZVVH8Qr`

```
  {
      "header": {
          "balance_burnt": "0",
          "chunk_hash": "29QUPr3jsmT5JccVjFCBbPnoYMct2P8p3G9ntZVVH8Qr",
          "encoded_length": 8,
          "encoded_merkle_root": "D7vyy5n5oKyZUBEWbj4VdyRktH4ZzBx1JnDMDaS8sDAG",
          "gas_limit": 1000000000000000,
          "gas_used": 0,
          "height_created": 1465617,
          "height_included": 0,
          "outcome_root": "11111111111111111111111111111111",
          "outgoing_receipts_root": "6m2bJP9TiEtxqHSzLygPCQqiGdgYQQYaSYTFeP2gEUQj",
          "prev_block_hash": "D7LAQwt9N3W1iB8Pm59BoftTNGVE6qqrebDogtD7vEKV",
          "prev_state_root": "32Wh26Ld31R6aXggpL3RHNEmcrKNjHyNX2HBJRtP4Vp7",
          "rent_paid": "0",
          "shard_id": 0,
          "signature": "ed25519:42PcsC7y6NWbc1rhEbtAWYokrYnKf3u5kLiXuXcqZdd6YHmpz8QRQsMo7qXTUDJkhGreUCZZMuRfdxkcCAuaaBAU",
          "tx_root": "11111111111111111111111111111111",
          "validator_proposals": [],
          "validator_reward": "0"
      },
      "receipts": [],
      "transactions": []
  }
```

>  Note: `tx` on the RPC is the same as `txStatus` on provider

Transaction look-up requires both the hash and the account ID.

>  Note: Passing through an empty account ID can still return a transaction, but not always.

`txStatus` for hash `8Ha8nvE7t1wHB8h5GdzMCnbDfCs9Zg1XeSLHo1umCVPy` and accountId: `dinoaroma"`

```
{
	receipts_outcome: [{
		block_hash: 'Cmg4AWrjLo8AfgtyLMAb3YUnMujfgRg2qH9DFxzzRuvN',
		id: 'DdDYjCEG5w49nmf5Da42Vk7HyriwSCE9tD8qaUJrcckm',
		outcome: {
			gas_burnt: 937144500000,
			logs: [],
			receipt_ids: [],
			status: { SuccessValue: '' }
		},
		proof: []
	}],

	status: {
    SuccessValue: ''
  },

	transaction: {
		actions: [{
      Transfer: {
        deposit: '1000000000000000000000000'
      }
    }],
    hash: '8Ha8nvE7t1wHB8h5GdzMCnbDfCs9Zg1XeSLHo1umCVPy',
    nonce: 2,
    public_key: 'ed25519:Cev7YwHpPHsH7mJDuUdcHxobvVSNzTHMBgpTYYYEUv26',
    receiver_id: 'bobblehead',
    signature:
		'ed25519:5wQqUxSwhZgw75oamBrFdRCno4tixejWiHA64LyzLGAwjp7pJAR795VctkAHsa2sybk7AzUWQDs1bg7eCdh4hrUU',
    signer_id: 'dinoaroma'
	},

	transaction_outcome: {
		block_hash: 'G5CCPBoQqPpqYf4e1SrQmJtymDsfnUCkFbKJAK1khbjp',
		id: '8Ha8nvE7t1wHB8h5GdzMCnbDfCs9Zg1XeSLHo1umCVPy',
		outcome: {
			gas_burnt: 937144500000,
			logs: [],
			receipt_ids: ['DdDYjCEG5w49nmf5Da42Vk7HyriwSCE9tD8qaUJrcckm'],
			status: {
        SuccessReceiptId: 'DdDYjCEG5w49nmf5Da42Vk7HyriwSCE9tD8qaUJrcckm'
      }
		},
		proof: []
	}
}

```

## To Do
- [ ] Expose `utils.nearAccountToEvmAddress`, otherwise users will not be able to pass through the EVM Address equivalent
