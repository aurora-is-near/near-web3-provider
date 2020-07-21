const utils = require('./utils')

module.exports = function (web3) {
	/**
	 * Formats the input of retrieveNear and converts all number values to HEX
	 *
	 * @method inputRetrieveNearFormatter
	 * @param {Object} options
	 * @returns object
	 */
	var inputRetrieveNearFormatter = function (options) {
		const dummyAddr = `0x${"00".repeat(20)}`
		const to = options.to;

		// use web3 formatter for all other options with options.to as hex so validation
		// will not fail with non-hex to
		options.to = dummyAddr
		options = web3.extend.formatters.inputTransactionFormatter(options);

		// reinsert non-hex near accountID to value
		options.to = to;
		return options
	};

	const extensions = {
	  property: 'near',
	  methods: [{
		  name: 'retrieveNear',
		  call: 'near_retrieveNear',
		  params: 1,
		  inputFormatter: [inputRetrieveNearFormatter],
		}]
	}

	return extensions;
}
