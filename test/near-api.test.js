const nearAPI = require('near-api-js');
const utils = require('../src/utils');
const {
  createKeyPair,
  waitForABlock,
  getLatestBlockInfo
} = require('./helpers');

const NEAR_ENV = process.env.NEAR_ENV || 'local';

const config = require('./config')[NEAR_ENV];
const NODE_URL = config.nodeUrl;
const ACCOUNT = require(config.keyPath);
const ACCOUNT_KEYPAIR = nearAPI.utils.KeyPair.fromString(ACCOUNT.secret_key);

const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
keyStore.setKey('test', ACCOUNT.account_id, ACCOUNT_KEYPAIR);
const signer = new nearAPI.InMemorySigner(keyStore);

// near-api-js new API
const nearConnection = async function () {
  return await nearAPI.connect(Object.assign({
    nodeUrl: NODE_URL,
    deps: {
      keyStore,
      signer
    }
  }, config));
};

describe('Near Connection', () => {
  let near;
  let nearProvider;

  // Connect to Near and expose JsonRpcProvider
  beforeAll(async () => {
    near = await nearConnection();
    nearProvider = near.connection.provider
  });

  describe('Testing Near connection and queries', () => {
    test('gets block information', async () => {
      const latestBlock = await getLatestBlockInfo(nearProvider);
      expect(latestBlock).toBeTruthy();
    })
  });

  describe('Gets block by different query types', () => {
    let blockInfo;

    beforeEach(async () => {
      blockInfo = await getLatestBlockInfo(nearProvider);
    });

    // PASSES. why no throw deprecating error?
    test('gets block information by block HEIGHT - number', async () => {
      const blockHeight = blockInfo.blockHeight;
      const block = await nearProvider.block(blockHeight);
      expect(block).toBeTruthy();
      expect(block.header.height).toEqual(blockHeight);
    });

    // PASSES, but args is supposed to be an object according to docs...
    // https://github.com/near/near-api-js/blob/158327ef7000958668d8bb0eda0e662cff433299/src/providers/json-rpc-provider.ts#L86
    test('gets block information by block HASH - string', async () => {
      const blockHash = blockInfo.blockHash;
      const block = await nearProvider.block(blockHash);
      expect(block).toBeTruthy();
      expect(block.header.hash).toEqual(blockHash);
    });


    // FAILS [-32602] Invalid params: Failed parsing args: invalid type: sequence, expected string or map
    test('gets block information by block Id { blockId }', async () => {
      const blockHash = blockInfo.blockHash;
      const block = await nearProvider.block({ "blockId": blockHash });
      expect(block).toBeTruthy();
      expect(block.header.hash).toEqual(blockHash);
    });

    // FAILS. BlockQuery vs blockId
    test('gets block information by block QUERY { blockQuery }', async () => {
      const blockHash = blockInfo.blockHash;
      const block = await nearProvider.block({ blockQuery: blockHash });
      expect(block).toBeTruthy();
      expect(block.header.hash).toEqual(blockHash);
    });

    // FAILS. [-32602]...{ blockQuery: { blockId }}?
    test('gets block information by block QUERY { blockquery: { blockId }}', async () => {
      const blockHash = blockInfo.blockHash;
      const block = await nearProvider.block({ blockQuery: { blockId: blockHash }});
      expect(block).toBeTruthy();
      expect(block.header.hash).toEqual(blockHash);
    });

    // FAILS. [-32602]...{ blockQuery: { blockId }}...stringify because it wants a string or a map?
    test('gets block information by block QUERY JSON.stringify({ blockQuery: { blockId }})', async () => {
      const blockHash = blockInfo.blockHash;
      const block = await nearProvider.block(JSON.stringify({ blockQuery: { blockId: blockHash }}));
      expect(block).toBeTruthy();
      expect(block.header.hash).toEqual(blockHash);
    });

    // FAILS. how to pass through finality?
    test('gets block information by block FINALITY - string', async () => {
      const finality = 'near-final';
      const block = await nearProvider.block(finality);
      expect(block).toBeTruthy()
    });

    // FAILS [-32602] Invalid params: Failed parsing args: invalid type: sequence, expected string or map
    test('gets block information by block FINALITY - object', async () => {
      const finality = 'near-final';
      const block = await nearProvider.block({ finality });
      expect(block).toBeTruthy()
    });

    // PASSES
    test('gets block information by block FINALITY - sendJsonRpc', async () => {
      const finality = 'near-final';
      const block = await nearProvider.sendJsonRpc('block', { finality });
      expect(block).toBeTruthy()
    });

    // PASSES
    test('gets block information by block ID - sendJsonRpc', async () => {
      const blockHash = blockInfo.blockHash;
      const block = await nearProvider.sendJsonRpc('block', { block_id: blockHash });
      expect(block).toBeTruthy()
    });
  });
});
