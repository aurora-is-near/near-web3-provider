# *NOTE: DO NOT USE THIS CURRENTLY*

# near-web3-provider

NEAR Protocol Web3 provider.
Use it to connect your Ethereum frontend or Truffle to NEAR Protocol.

## Description

NEAR Protocol is a sharded, proof-of-stake blockchain. Keeping that in mind, some Ethereum concepts are naturally not shared with NEAR; for example, there is no concept of uncle blocks, pending blocks, or block difficulty.

As a sharded blockchain, the structure of NEAR blocks is also different. In Ethereum, blocks have transactions. In NEAR, blocks have chunks, and chunks have transactions.

`near-web3-provider` has been adapted to follow `web3` as closely as possible, but where there are no equivalents, empty values have been passed through. Other return values have been adapted to account for the difference in block structure (for example, the root of the transaction trie comes from a chunk rather than a block). If a method has no direct translation, an `Unsupported method` error is returned.

## Install

```bash
npm install near-web3-provider
```

## Requirements

**Node > 11.0**

## General Usage

You can use this provider wherever a Web3 provider is needed.

```javascript
const nearlib = require('nearlib');
const NearProvider = require("near-web3-provider");

const accountId = '<account id to use for tx>';
const keyStore = new nearlib.keyStores.<one of keyStores>;

const web = new Web3();
web.setProvider(new NearProvider("<url to NEAR RPC>", keyStore, accountId));
web.eth.net.isListening();
```

## Using in Truffle

Add to your `truffle-config.json`:

```javascript
const nearlib = require('nearlib');
const NearProvider = require("near-web3-provider");

// Use standard near-shell structure for storing keys.
const keyStore = new nearlib.keyStores.UnencryptedFileSystemKeyStore('neardev');

module.exports = {
  networks: {
    near: {
        network_id: "99",
        provider: function() {
            return new NearProvider("https://rpc.nearprotocol.com", keyStore, 'accounttest')
        },
    }
  }
}
```

## API

TODO: Add in API methods and differences with web3.

`eth_getTransactionByBlockHashAndIndex` - how can you get the transaction by index if it is nested inside chunks? should we unfold chunks until that index is found? keep a count and only get transactions up until that point.
-------------------------

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

-------------

### Notes/Questions

#### EVM Contract Calling

I've tried `this.nearProvider.query('call/evm/utils.near_account_id_to_evm_address/', JSON.stringify(accountId))`

This returns:

```
Querying call/evm/utils.near_account_id_to_evm_address} failed: wasm execution failed with error: FunctionCallError(CompilationError(PrepareError(GasInstrumentation))).
{
  "block_height": 1079329,
  "error": "wasm execution failed with error: FunctionCallError(CompilationError(PrepareError(GasInstrumentation)))",
  "logs": []
}
```

- [ ] Do I need to pass gas in? How much gas and where?
- [ ] How should I call evm contract methods?
- [ ] Is the contract deployed to NEAR under `evm`?

`utils.evm_account_to_internal_address` - will this map ETH addresses to near account IDs?

#### Accounts

- Do accounts need to be created with NEAR first and then converted to an EVM address or vice versa or it doesn't matter?

#### Chain Information

- Where can you get chain information? `nearlib` doesn't provide access to chain data.
  - `nearcore` has it, but it's in Rust. How to get? [chain reference](https://github.com/nearprotocol/nearcore/tree/master/chain/chain/src)
- Need chain information for ETH Sync Object

#### Transactions and Chunks

- Why don't I see transactions even though I've sent money back and forth between accounts? What counts as a transaction? accountId @liau has 3 sent transactions and 4 received, but I don't see any of them.

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

#### Method Questions

`eth_syncing`

- [ ] Syncing always returns `false` even though values are updating. What exactly does this property refer to?
- [ ] Chain information for `startingBlock`, `highestBlock`, `knownStates`, `pulledStates`
- [ ] Expected return object:
    ```
    const blockInfo = {
      startingBlock: '0x0',
      currentBlock: decToHex(sync_info.latest_block_height),
      highestBlock: '0x0',
      // Not listed in RPC docs but expected in web3
      knownStates: '0x0',
      pulledStates: '0x0'
  };
    ```

`eth_gasPrice`

- [ ] Where is gas price listed?
- [ ] Is this referring to NEAR gas price or ETH gas price? Are these the same or different?

`eth_accounts`

- [ ] Do all NEAR accounts have an equivalent EVM address?
- [ ] Are there address collisions?


#### ETH to NEAR and NEAR to ETH values

No conversion. All inputs in nearlib are denominated in yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)

[NEAR divisibility is a yoctonear 10^24](https://docs.nearprotocol.com/docs/roles/developer/examples/nearlib/guides#send-yourself-money)

#### Timestamp

NEAR timestamp is 1000000 the size of a normal date. Had to do some weird stuff to be able to pass an acceptable hex value. Is this going to be an issue?

#### Storage

I don't understand `storage_paid_at` and `storage_usage` and if they have an ETH equivalent.

