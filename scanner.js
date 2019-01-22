require('colors');
const deasync = require('deasync');
const debug = require('./debug');
const bitcoin = require('./bitcoin');
const payment = require('./payment');
const assert = require('assert');
const async = require('async');
const { lpad, rpad, numpad } = require('./utils');
const model = {
    invoice: require('./models/invoice'),
    state: require('./models/state'),
    payment: require('./models/payment'),
};

const txArrayString = (vtx) => {
    let s = '';
    for (const tx of vtx) {
        s += `  ${tx.address} id=${tx.txid} c=${lpad(tx.category, 8)} v=${numpad(''+tx.amount,2,8)}\n`;
    }
    return s;
}

const scanner = {
    findGenesisBlock(cb) {
        bitcoin.getBlockHash(0, (err, info) => {
            if (err) return cb(err);
            cb(err, info.result);
        });
    },
    checkWalletConflicts(tx, affectedInvoices, cb) {
        if (!cb) { cb = affectedInvoices; affectedInvoices = {}; }
        if (typeof(tx) === 'string') {
            try {
                tx = bitcoin.getTransactionS(tx).result;
            } catch (e) {
                return cb(e);
            }
        }
        // console.log(`*** ${JSON.stringify(tx)} ***`);
        if (tx.walletconflicts.length > 0) {
            // console.log(`- checking wallet conflict txs ${JSON.stringify(tx.walletconflicts)}`);
            async.eachSeries(
                tx.walletconflicts,
                (txid, escb) => {
                    let ctx;
                    try {
                        ctx = bitcoin.getTransactionS(txid).result;
                    } catch (ce) {
                        // console.log(`ERROR FETCHING TXID=${txid}: ${JSON.stringify(ce)}`);
                        return escb();
                    }
                    // console.log(`ctx = ${JSON.stringify(ctx)}`);
                    payment.updatePayment(ctx, (u2err, u2invoiceId) => {
                        if (!u2err && u2invoiceId) affectedInvoices[u2invoiceId] = true;
                        escb(u2err);
                    });
                },
                cb
            );
        } else cb(null);
    },
    checkTransactions(transactions, cb) {
        const affectedInvoices = {};
        async.eachSeries(
            transactions,
            (transaction, transactionCallback) => {
                const paymentCallback = (err, invoiceId) => {
                    if (invoiceId) affectedInvoices[invoiceId] = true;
                    transactionCallback();
                };
                let tx = transaction;
                if (typeof(transaction) === 'string') {
                    try {
                        tx = bitcoin.getTransactionS(transaction).result;
                    } catch (e) {
                        model.payment.findByTxId(transaction, (pmtErr, payments) => {
                            if (pmtErr || payments.length === 0) return paymentCalback(); // unrelated transaction
                            const [ payment ] = payments;
                            paymentCallback(null, payment.invoice);
                        });
                        return;
                    }
                }
                // console.log(`updating payment for ${tx.txid} with walletconflicts=${tx.walletconflicts}`);
                payment.updatePayment(tx, (e,r) => {
                    if (e) return paymentCallback(e);
                    this.checkWalletConflicts(tx, affectedInvoices, paymentCallback);
                });
            },
            () => cb(null, Object.keys(affectedInvoices))
        );
    },
    checkWatchedInvoices(cb) {
        model.invoice.getWatchedInvoices((err, invoices) => {
            if (err) return cb(err);
            // console.log(`checking ${invoices.length} watched invoices`);
            async.eachSeries(
                invoices,
                (invoice, invoiceSeriesCallback) => {
                    // find all payments and check for wallet conflicts
                    model.payment.findByAddr(invoice.addr, (err, payments) => {
                        if (err) return invoiceSeriesCallback(err);
                        async.eachSeries(
                            payments,
                            (payment, paymentSeriesCallback) => {
                                // console.log(`checkWalletConflicts(${payment.txid})`);
                                this.checkWalletConflicts(payment.txid, paymentSeriesCallback);
                            },
                            () => payment.updateInvoice(''+invoice._id, invoiceSeriesCallback)
                        );
                    });
                },
                cb
            );
        });
    },
    scanFromHash(blockHash, cb) {
        bitcoin.listSinceBlock(blockHash, (err, info) => {
            if (err) {
                // if this is "Block not found", this may be because a new regtest instance was started
                if (err.code === -5 && err.message === "Block not found") {
                    debug('last block hash seems to be invalid; scanning from genesis block');
                    this.findGenesisBlock((err, genesishash) => {
                        if (err) return cb(err);
                        this.scanFromHash(genesishash, cb);
                    });
                    return;
                }
                return cb(err);
            }
            const result = info.result;
            // anything new?
            let z = '';
            for (const tx of result.transactions) {
                z += `\n${tx.txid}.${tx.confirmations}`;
            }
            if (result.lastblock === blockHash && z === this.lsbcached) return cb(null, blockHash, []);
            this.lsbcached = z;
            debug(`listSinceBlock ${blockHash} (depth=${result.depth}) [new last=${result.lastblock}] -> \n${txArrayString(info.result.transactions)}`);
            let autoCheckWatched = false;
            for (const tx of info.result.transactions) {
                // if (tx.txid !== this.lastconsoleloggedtxtxid) {
                //     console.log(`- ${tx.txid}`.yellow);
                //     this.lastconsoleloggedtxtxid = tx.txid;
                // }
                if (tx.category === 'orphan') {
                    // console.log('found orphan transaction; auto-check watched flag set');
                    autoCheckWatched = true;
                    break;
                }
            }
            const newBlockHash = result.lastblock;
            this.checkTransactions(result.transactions, (err2, affectedInvoices) => {
                // agggregate
                debug(`affected invoices: ${JSON.stringify(affectedInvoices)}`);
                // if (this.lastprintedset !== newBlockHash) {
                //     this.lastprintedset = newBlockHash;
                //     console.log(`lastblockhash => ${newBlockHash}`);
                // }
                model.state.set('lastblockhash', newBlockHash, () => {
                    debug(`   :: ${newBlockHash} [${JSON.stringify(affectedInvoices)}]`);
                    if (autoCheckWatched) {
                        setTimeout(() => this.checkWatchedInvoices(() => cb(null, newBlockHash, affectedInvoices)), 2000);
                    } else cb(null, newBlockHash, affectedInvoices);
                });
            });
        });
    },
    scan(cb) {
        model.state.get('lastblockhash', (lastblockhash) => {
            if (this.lastprintedscanfrom !== lastblockhash) {
                this.lastprintedscanfrom = lastblockhash;
                debug('scanning from last block hash');
                // console.log(`scan from ${lastblockhash}`);
            }
            if (!lastblockhash) {
                debug('no last block hash; scanning from genesis block');
                this.findGenesisBlock((err, genesishash) => {
                    if (err) return cb(err);
                    this.scanFromHash(genesishash, cb);
                });
                return;
            }
            this.scanFromHash(lastblockhash, cb);
        });
    },
};

module.exports = scanner;
