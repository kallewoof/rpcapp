const bcrpc = require('bcrpc');
const config = require('./config');
const utils = require('./utils');

utils.deasyncObject(bcrpc);

const up = (config) => new bcrpc({
        prot: 'http',
        host: config.host,
        port: config.rpcport,
        user: config.user,
        pass: config.pass,
    });

const client = up(config.bitcoind);

client.switchNode = (config) => {
    const n = up(config);
    for (const k of Object.keys(n)) {
        client[k] = n[k];
    }
};

module.exports = client;
