const debug = require('./debug');
const model = {
    invoice: require('./models/invoice'),
    state: require('./models/state'),
    payment: require('./models/payment'),
    history: require('./models/history'),
};
const payment = require('./payment');
const async = require('async');
const assert = require('assert');
const config = require('./config');
const utils = require('./utils');
const scanner = require('./scanner');

const API = {
    /**
     * Create a new invoice. 
     * Syntax: create <amount> <content>
     * Example: create 0.001 "A pair of socks."
     */
    create(amountBTC, content, cb) {
        const amount = utils.satoshiFromBTC(amountBTC);
        assert(utils.verifyBTC(amountBTC));
        assert(amount > config.minimumSatoshi);
        assert(content);
        payment.createInvoice(amount, content, cb);
    },
    /**
     * Iterate all invoices updated after `since` (optional; if unset, iterates
     * all invoices).
     * For each invoice, iterCB(invoice, state, callback) is called, where state
     * is the state object as given by payment.updateInvoice. The callback
     * given must be called.
     * After the last call to iterCB, endCB() is called.
     * If an error occurs, endCB(err) is called and iteration is aborted.
     */
    iterInvoices(since, iterCB, endCB) {
        const query = since ? { updated: { $gt: since }} : {};
        model.invoice.find(query, { updated: -1 }, (err, invoices) => {
            if (err) return endCB(err);
            async.eachSeries(
                invoices,
                (invoice, asyncCallback) => {
                    payment.updateInvoice(invoice._id, (err, state) => {
                        if (!err) iterCB(invoice, state, asyncCallback);
                    });
                },
                endCB
            );
        });
    },
    /**
     * Get info about the invoice with the given ID.
     * Eventually calls cb(err, invoice, state).
     */
    info(invoiceid, cb) {
        payment.updateInvoice(invoiceid, (err, state) => {
            if (err) return cb(err);
            model.invoice.findById(invoiceid, (err2, invoices) => {
                if (err2) return cb(err2);
                if (invoices.length === 0) return cb(`Invoice not found: ${invoiceid}`);
                const [ invoice ] = invoices;
                cb(null, { invoice, state });
            });
        });
    },
    /**
     * Fetch history related to the given invoice and/or payment.
     */
    history(invoiceid, paymentid, cb) {
        if (!cb) { cb = paymentid; paymentid = null; }
        model.history.find(invoiceid, paymentid, cb);
    },
    /**
     * Wait until the status of the given invoice becomes the desired status.
     */
    waitForStatus(invoiceid, desiredStatus, timeout, cb) {
        if (!cb) { cb = timeout; timeout = 2000; }
        let gotstatus = false;
        let isbroken = false;
        let scanErr = null;
        async.waterfall([
            (callback) => payment.updateInvoice(invoiceid, callback),
            (result, callback) => model.invoice.findById(invoiceid, callback),
            (invoices, callback) => {
                const [ invoice ] = invoices;
                gotstatus = invoice.status === desiredStatus;
                const expiry = new Date().getTime() + timeout;
                const listener = payment.listen('invoice.update', (args, listenCB) => {
                    const { invoiceId, status } = args;
                    if (invoiceId === invoiceid) gotstatus = status === desiredStatus;
                });
                async.whilst(
                    () => !gotstatus && !isbroken && expiry > new Date().getTime(),
                    (asyncCallback) => {
                        scanner.scan((err, lastblockhash, affectedInvoices) => {
                            if (err) {
                                isbroken = true;
                                scanErr = err;
                                return asyncCallback();
                            }
                            if (affectedInvoices.length > 0) {
                                async.eachSeries(
                                    affectedInvoices,
                                    (invoice, seriesCallback) =>
                                        payment.updateInvoice(invoice, seriesCallback),
                                    (err) => {
                                        if (gotstatus) return asyncCallback();
                                        setTimeout(asyncCallback, 200);
                                    }
                                );
                                return;
                            }
                            setTimeout(asyncCallback, 200);
                        });
                    },
                    (err) => {
                        if (err) return callback(err);
                        if (gotstatus) return callback(null);
                        if (scanErr) return callback(scanErr);
                        return callback('timeout waiting for invoice to become paid');
                    }
                );
            },
        ], (err) => cb(err));
    },
    /**
     * Wait until the scanner detects a new block, or until the last block
     * becomes the wanted one. Once this happens, all affected invoices are
     * updated before the callback is called.
     */
    waitForChange(wantedBlockHash, timeout, cb) {
        if (!cb) { cb = timeout; timeout = 2000; }
        if (!cb) { cb = wantedBlockHash; wantedBlockHash = null; }
        const expiry = new Date().getTime() + timeout;
        let currentLastBlockHash;
        model.state.get('lastblockhash', (lastblockhash) => {
            currentLastBlockHash = lastblockhash;
            let seenLastBlockHash = currentLastBlockHash;
            const f = wantedBlockHash
                    ? () => seenLastBlockHash !== wantedBlockHash && expiry > new Date().getTime()
                    : () => seenLastBlockHash === currentLastBlockHash && expiry > new Date().getTime()
            async.whilst(
                f,
                (whilstCallback) => {
                    scanner.scan((err, newLastBlockHash, affectedInvoices) => {
                        if (err) return whilstCallback(err);
                        if (newLastBlockHash !== seenLastBlockHash || affectedInvoices.length > 0) {
                            seenLastBlockHash = newLastBlockHash;
                            async.eachSeries(
                                affectedInvoices,
                                (invoice, seriesCallback) => payment.updateInvoice(invoice, seriesCallback),
                                whilstCallback
                            );
                        } else {
                            setTimeout(whilstCallback, 200);
                        }
                    });
                },
                (err) => {
                    if (!err && seenLastBlockHash === currentLastBlockHash) err = 'timeout waiting for new block hash';
                    cb(err);
                }
            );
        });
    },
};
utils.deasyncObject(API);

module.exports = API;
