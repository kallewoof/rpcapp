const config = {
    bitcoind: {
        host: process.env.BITCOIND_HOST || 'localhost',
        rpcport: process.env.BITCOIND_RPCPORT || 18443,
        user: process.env.BITCOIND_USER || 'user',
        pass: process.env.BITCOIND_PASS || 'password',
    },
    minimumSatoshi: process.env.MIN_SATOSHI || 10000,
    requiredConfirmations: process.env.REQUIRED_CONFIRMATIONS || 6,
    thresholdSatoshi: process.env.THRESHOLD_SATOSHI || 100,
};

module.exports = config;
