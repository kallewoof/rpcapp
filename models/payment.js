const config = require('../config');
const db = require('../db');
const assert = require('assert');
const history = require('./history');

const model = {
    create(txid, addr, invoice, amount, cb = null) {
        assert(amount > 0);
        assert(txid);
        assert(addr);
        assert(invoice);
        const status = 'pending';
        db.insert(
            'payment',
            { txid, addr, invoice, amount, status },
            (err, result) => {
                // console.log(`payment created: ${result.insertedIds}: ${txid}, ${invoice}`);
                if (!err) {
                    const [ paymentId ] = result.insertedIds;
                    history.create(invoice, paymentId, {
                        paymentId,
                        amount,
                        invoiceId: invoice,
                        action: 'receive',
                    }, `received ${amount}`, () => cb(null, result));
                } else cb(err, result);
            }
        );
    },
    upToDate(payment, transaction) {
        assert(payment);
        assert(transaction);
        return (payment.amount === transaction.amount);
    },
    update(txid, addr, invoice, amount, cb = null) {
        assert(amount > 0);
        assert(txid);
        assert(addr);
        assert(invoice);
        this.findByTxId(txid, (err, result) => {
            if (err) return cb ? cb(err) : null;
            const [ payment ] = result;
            history.create(invoice, payment._id, {
                action: 'adjust',
                invoiceId: invoice,
                paymentId: payment._id,
            }, 'updated payment record', () => db.update(
                'payment',
                { txid },
                { addr, invoice, amount },
                cb
            ));
        });
    },
    setStatus(paymentId, status, cb) {
        assert(paymentId);
        assert(status);
        assert(cb);
        this.findById(paymentId, (err, result) => {
            if (err) return cb(err);
            const [ payment ] = result;
            if (payment.status === status) return cb(null);
            history.create(payment.invoice, paymentId, {
                action: 'update',
                invoiceId: payment.invoice,
                paymentId,
            }, `updated payment status from ${payment.status} to ${status}`, () => db.update(
                'payment',
                { _id: db.id(paymentId) },
                { status },
                cb
            ));
        });
    },
    find(q, cb) {
        assert(cb);
        db.find('payment', q, cb);
    },
    findById(id, cb) {
        assert(id);
        this.find({ _id: db.id(id) }, cb);
    },
    findByTxId(txid, cb) {
        assert(txid);
        this.find({ txid }, cb);
    },
    findByAddr(addr, cb) {
        assert(addr);
        this.find({ addr }, cb);
    },
};

module.exports = model;
