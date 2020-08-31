const utils = require('./utils');

module.exports = function (web3) {
    /**
	 * Formats the input of retrieveNear and transferNear and converts all number values to HEX
	 *
	 * @method inputRetrieveNearFormatter
	 * @param {Object} options
	 * @returns object
	 */
    var inputTxNearRecipientFormatter = function (options) {
        const dummyAddr = `0x${'00'.repeat(20)}`;
        const to = options.to.toLowerCase();

        if (!utils.isValidAccountID(to)) {
            throw new Error(`invalid near accountID: ${to}`);
        }

        // use web3 formatter for all other options with options.to as hex so validation
        // will not fail with non-hex to
        options.to = dummyAddr;
        options = web3.extend.formatters.inputTransactionFormatter(options);

        // reinsert non-hex near accountID to value
        options.to = to;
        return options;
    };

    // add near specific utility functions
    const near_utils = {
        hexToBase58: utils.hexToBase58,
        base58ToHex: utils.base58ToHex,
    };
    web3.utils = {...web3.utils, ...near_utils};

    // prepare near specific blockchain operations
    const extensions = {
        property: 'near',
        methods: [
            {
                name: 'retrieveNear',
                call: 'near_retrieveNear',
                params: 1,
                inputFormatter: [inputTxNearRecipientFormatter],
            },
            {
                name: 'transferNear',
                call: 'near_transferNear',
                params: 1,
                inputFormatter: [inputTxNearRecipientFormatter],
            },
        ]
    };

    return extensions;
};
