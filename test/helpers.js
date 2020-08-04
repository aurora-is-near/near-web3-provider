/**
 * Helpers
 */

module.exports.createKeyPair = function (nearAPI) {
  return nearAPI.utils.KeyPair.fromString(ACCOUNT_KEY);
}

module.exports.getLatestBlockInfo = async function (nearProvider) {
  const { sync_info } = await nearProvider.status();
  const block = {
    blockHash: sync_info.latest_block_hash,
    blockHeight: sync_info.latest_block_height
  };

  return block;
}

module.exports.waitForABlock = async function () {
  return await new Promise((r) => setTimeout(r, 1000));
}
