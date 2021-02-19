/**
 * Helpers
 */

const utils = require('../src/utils');

async function getLatestBlockInfo(nearProvider) {
    const { sync_info } = await nearProvider.status();
    const { latest_block_hash, latest_block_height } = sync_info;
    const block = {
        blockHash: utils.base58ToHex(latest_block_hash),
        blockHeight: latest_block_height
    };

    return block;
}

async function waitForABlock() {
    return await new Promise((r) => setTimeout(r, 1000));
}

module.exports = { getLatestBlockInfo, waitForABlock };
