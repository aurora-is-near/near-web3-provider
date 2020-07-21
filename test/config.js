const path = require('path');
const keyPath =
module.exports = {
    local: {
        networkId: 'local',
        nodeUrl: 'http://localhost:3030',
        keyPath: path.resolve('../nearcore/testdir/.near/validator_key.json')
    }
};
