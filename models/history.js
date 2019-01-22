const config = require('../config');
const db = require('../db');
const assert = require('assert');

const model = {
    create(invoice, payment, what, content, cb = null) {
        assert(invoice);
        assert(what);
        assert(content);
        const date = new Date();
        if (invoice) invoice = '' + invoice; // de-ObjectID()-ify for consistency
        if (payment) payment = '' + payment; // same
        db.insert(
            'history',
            { invoice, payment, what, content, date },
            cb
        );
    },
    findLast(invoice, payment, cb) {
        assert(invoice);
        assert(payment);
        if (invoice) invoice = '' + invoice;
        if (payment) payment = '' + payment;
        db.find('history', { invoice, payment }, { date: -1 }, (err, result) => {
            if (err) return cb(err);
            cb(null, result.length ? result[result.length - 1] : null);
        });
    },
    findByInvoice(invoice, cb) {
        assert(invoice);
        invoice = '' + invoice;
        db.find('history', { invoice }, cb);
    },
    findByPayment(payment, cb) {
        assert(payment);
        payment = '' + payment;
        db.find('history', { payment }, cb);
    },
    find(invoice, payment, cb) {
        const query = {};
        if (invoice) query.invoice = '' + invoice;
        if (payment) query.payment = '' + payment;
        db.find('history', query, { _id:1 }, cb);
    }
};

module.exports = model;
