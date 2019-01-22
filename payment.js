const debug = require('./debug');
const config = require('./config');
const bitcoin = require('./bitcoin');
const db = require('./db');
const model = {
    invoice: require('./models/invoice'),
    payment: require('./models/payment'),
    history: require('./models/history'),
};
const async = require('async');
const assert = require('assert');
const utils = require('./utils');
const { EventSource } = require('./events');

const payment = {
    /**
     * 1. Get a new address designated for this payment.
     * 2. Link the address to the amount, and put into DB.
     * 3. Return the address via the callback.
     */
    createInvoice(satoshi, content, cb) {



        // TASK 1: Creating model.invoice
        // Using the bitcoin module, creates a new address, and create a new invoice.
        //
        // HINT: bitcoin uses bitcoin-cli through the bcrpc (bitcoin RPC) wrapper.
        // You can use the same commands, but in a different letter case.
        // For example, getblockcount (bitcoin-cli), becomes getBlockCount (bcrpc).
        // Because it is asynchronous, bitcoin.FUNCTION_NAME(Param_1, Param_2, ..., (Error_Var, Result_Var) => {
        //   If Error_Var is not null, outputs cb(Error_var)
        //   else, outputs Result_Var.result
        // });
        // If you're unfamiliar with asynchronous programming, there are resources on the Internet.


        // Warning: You need to delete the following line.
        cb('You haven\'t written this!');
    },
    paymentStatusWithColor(status) {
        return status[{
            tx_unavail: 'red',
            reorg: 'red',
            confirmed: 'green',
            pending: 'yellow',
        }[status]];
    },
    /**
     * Update an invoice's status. This method checks for double spends,
     * reorgs, etc. and sets the invoice status as appropriate.
     * The callback signature is (error, didUpdate), where didUpdate is true
     * if the invoice was modified, and false if it remained the same.
     */
    updateInvoice(invoiceId, cb) {
        model.invoice.findById(invoiceId, (err, invoices) => {
            if (err) return cb(err);
            if (invoices.length === 0) return cb("invoice " + invoiceId + " not found");
            const invoice = invoices[0];
            model.payment.findByAddr(invoice.addr, (pmtErr, payments) => {
                if (pmtErr) return cb(pmtErr);


                // Important variables for invoice status
                let finalAmount = 0;    // Final confirmed sum
                let totalAmount = 0;    // Total amount (confirmed + unconfirmed)
                let disabledAmount = 0; // Sum of money lost (was there but not anymore)
                let minConfirms = 999;  // minimum confirmations
                let maxConfirms = 0;    // maximum confirmations


                async.eachSeries(
                    payments,
                    (payment, asyncCallback) => {
                        debug(`checking payment with txid ${payment.txid}`);
                        bitcoin.getTransaction(payment.txid, (gtErr, response) => {
                            if (gtErr) {
                                // transaction is missing or erroneous; we don't consider this an unrecoverable error, we simply don't count this transaction
                                debug('warning: transaction %s for payment %s cannot be retrieved: %s', payment.txid, payment._id, gtErr);
                                model.payment.setStatus(
                                    payment._id,
                                    'tx_unavail',
                                    asyncCallback
                                );
                                return;
                            }
                            const transaction = response.result;
                            // console.log(`   TX = ${JSON.stringify(transaction)}`);

                            // Sometimes the details of an address is an array.
                            // In those cases, we need to find the correct element.
                            this.matchTransactionToAddress(transaction, invoice.addr);

                            const { amount, confirmations, blockhash } = transaction;
                            debug(`-> amount: ${amount} BTC to addr: ${transaction.address} (${confirmations} confirmations) in block ${blockhash}`);
                            const amountSatoshi = utils.satoshiFromBTC(amount);


                            // TASK 2: handling payment
                            // Here, we observe the payment status of an invoice
                            // Check payment confirmation, add it up,
                            // and update the invoice status in TASK 3.
                            // Lastly, call model.payment.setStatus.
                            // TODO: Update the necessary variable from the status of invoice above


                            // TODO: Insert the code for TASK 2 here!


                            // In the end of TASK 2:

                            model.payment.setStatus(
                                payment._id,



                                // if payment is confirmed (in other words, confirmations >= config.requiredConfirmations),
                                //  'confirmed',
                                // If unconfirmed,
                                'pending',
                                // (Always becomes pending, without correction)


                                asyncCallback
                            );

                            // END of TASK 2
                        });
                    },
                    () => {


                        // TASK 3: updating invoice
                        // Collect all info from payment invoice in TASK 2
                        // Here, based on the collected info (variables),
                        // the invoice status is updated.
                        // When update is finished, cb (callback) is called.
                        // Here, a helper function cbwrap is used.
                        // TODO: Please insert the variables collected in TASK 2


                        const confirmations = 0; // How many confirmations does this invoice have? In case of multiple payments, how should we think about this?
                        const pendingAmount = 0; // Only unconfirmed amount
                        const finalRem = 0; // From the confirmed amount, how much is unpaid?
                        const totalRem = 0; // From the total amount paid, how much is unpaid?
                        const finalMatch = false; // After confirmation, if the paid amount is exact (true) or not (false)
                        const totalMatch = false; // Unconfirmed + Confirmed

                        const cbwrap = (err, updated) => {
                            // console.log(`${updated ? '!!!' : '...'} c=${confirmations} fr=${finalRem} tr=${totalRem} fm=${finalMatch} tm=${totalMatch}`);
                            if (!err && updated) this.sig('invoice.updated', { invoiceId, status: updated });
                            const keepWatching = confirmations < 100 || !finalMatch || pendingAmount > 0;
                            const finalcb = () => cb(err, { payments, confirmations, updated, finalAmount, pendingAmount, disabledAmount, finalMatch, totalMatch });
                            if (keepWatching !== invoice.watched) {
                                model.invoice.setWatchedState(invoiceId, keepWatching, finalcb);
                            } else finalcb();
                        };

                        // Using finalRem, totalRem etc., execute model.invoice.updateStatus
                        // There are a total of 7 possible status. It's not necessary to check whether or not the current status is the same.
                        // Ordering is of course, important.

                        // TODO: if (???) return model.invoice.updateStatus(invoiceId, 'paid', cbwrap);
                        // TODO: if ...


                        // Warning: Check that model.invoice.updateStatus(..., ..., cbwrap) is called!
                        model.invoice.updateStatus(invoiceId, '???', cbwrap);
                    }
                );
            });
        });
    },
    /**
     * Transactions sometimes send to multiple addresses simultaneously.
     * We tweak the transaction so that its address and amount values are
     * set to the values for the given address.
     *
     * Note: the system will NOT detect multiple sends to the same address
     * within the same transaction. These cases will result in a loss for the
     * sender until the database is updated manually.
     */
    matchTransactionToAddress(transaction, addr) {
        if (transaction.address === addr) return;
        if (transaction.details) {
            for (const d of transaction.details) {
                if (d.address === addr) {
                    assert(d.amount);
                    transaction.address = d.address;
                    transaction.amount = Math.abs(d.amount);
                    return;
                }
            }
        }
        transaction.address = addr;
    },
    /**
     * Locate the invoice for the given transaction, by looking at all its
     * potential addresses. This method also updates the transaction.address
     * and .amount values to the values matching the address.
     */
    findInvoiceForTransaction(transaction, cb) {
        const addresses = [];
        if (transaction.address) addresses.push([ transaction.address, transaction.amount ]);
        if (transaction.details) {
            for (const d of transaction.details) {
                addresses.push([ d.address, Math.abs(d.amount) ]);
            }
        }
        let invoice;
        async.detectSeries(
            addresses,
            ([ addr, amt ], detectCallback) => {
                model.invoice.findByAddr(addr, (err, invoices) => {
                    if (err) return detectCallback(err);
                    if (invoices.length === 0) return detectCallback();
                    if (invoices.length > 1) return detectCallback("multiple invoices with same address detected; database is corrupted\n");
                    invoice = invoices[0];
                    transaction.address = addr;
                    transaction.amount = amt;
                    detectCallback(null, true);
                });
            },
            (addrErr) => cb(addrErr, { transaction, invoice })
        );
    },
    /**
     * Create a new payment object for a given invoice, and attach the transaction
     * to it.
     */
    createPaymentWithTransaction(transactionIn, cb) {
        this.findInvoiceForTransaction(transactionIn, (err, { transaction, invoice }) => {
            if (err) return cb(err);
            if (!invoice) return cb('invoice not found for transaction');
            model.payment.create(transaction.txid, transaction.address, invoice._id, transaction.amount, (crtErr, crtRes) => {
                if (!crtErr)
                    this.sig('payment.created', { transaction, invoice, paymentId: crtRes.insertedIds[0] });
                cb(crtErr, invoice._id);
            });
        });
    },
    /**
     * Update existing payment with a transaction.
     */
    updatePaymentWithTransaction(payment, transactionIn, cb) {
        this.findInvoiceForTransaction(transactionIn, (err, { transaction, invoice }) => {
            if (!invoice) return cb('invoice not found for transaction');
            if (model.payment.upToDate(payment, transaction)) return cb(null, invoice._id);
            model.payment.update(transaction.txid, transaction.address, invoice._id, transaction.amount, (updErr, updRes) => {
                if (!updErr)
                    this.sig('payment.updated', { transaction, invoice, paymentId: payment });
                cb(updErr, invoice._id);
            });
        });
    },
    /**
     * Update existing or create new payment with a transaction.
     */
    updatePayment(transaction, cb) {
        debug(`update payment with transaction ${JSON.stringify(transaction)}`);
        if (!transaction.txid || (!transaction.address && !transaction.details) || transaction.amount < 0) {
            debug(`ignoring irrelevant transaction ${JSON.stringify(transaction)}`);
            return cb('Ignoring irrelevant transaction.');
        }
        model.payment.findByTxId(transaction.txid, (err, payments) => {
            if (err) return cb(err);
            if (payments.length > 0) {
                // payment with matching txid and address
                debug(`updating existing payment with txid ${transaction.txid}`);
                this.updatePaymentWithTransaction(payments[0], transaction, cb);
            } else {
                // no payment exists; make one
                debug(`creating new payment with txid ${transaction.txid}`);
                this.createPaymentWithTransaction(transaction, cb);
            }
        });
    },
};
utils.deasyncObject(payment, ['paymentStatusWithColor']);

payment._e = new EventSource(payment);

module.exports = payment;
