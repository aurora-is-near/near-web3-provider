const BN = require('bn.js');

const consts = {};

/// Method names from EVM.

consts.DEPLOY_CODE_METHOD_NAME = 'deploy_code';
consts.CALL_METHOD_NAME = 'call';
consts.RAW_CALL_METHOD_NAME = 'raw_call';
consts.META_CALL_METHOD_NAME = 'meta_call';
consts.DEPOSIT_METHOD_NAME = 'deposit';
consts.WITHDRAW_METHOD_NAME = 'withdraw';
consts.TRANSFER_METHOD_NAME = 'transfer';
consts.VIEW_METHOD_NAME = 'view';
consts.GET_BALANCE_METHOD_NAME = 'get_balance';
consts.GET_STORAGE_AT_METHOD_NAME = 'get_storage_at';
consts.GET_CODE_METHOD_NAME = 'get_code';
consts.GET_NONCE_METHOD_NAME = 'get_nonce';

consts.GAS_AMOUNT = new BN('300000000000000');
consts.ZERO_ADDRESS = `0x${'00'.repeat(20)}`;

consts.NEAR_NET_VERSION = '1313161554';
consts.NEAR_NET_VERSION_TEST = '1313161555';
consts.NEAR_NET_VERSION_BETANET = '1313161556';


module.exports = consts;
