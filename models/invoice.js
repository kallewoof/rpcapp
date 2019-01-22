const config = require('../config');
const db = require('../db');
const assert = require('assert');
const history = require('./history');

const model = {
    create(amount, content, addr, cb) {
        assert(amount >= config.minimumSatoshi);
        assert(addr);
        const created = new Date();
        const updated = created;
        db.insert(
            'invoice',
            { created, updated, amount, content, addr, watched: true, received: 0, status: 'unpaid' },
            (err, result) => {
                if (!err) {
                    const [ invoiceId ] = result.insertedIds;
                    history.create(invoiceId, null, {
                        invoiceId,
                        action: 'create',
                    }, 'invoice created', () => cb(null, result));
                } else cb(err, result);
            }
        );
    },
    getWatchedInvoices(cb) {
        assert(cb);
        this.find(
            { watched: { $ne: false }},
            (err, res) => {
                cb(err, res);
            }
        );
    },
    setWatchedState(invoiceId, watchedState, cb) {
        assert(invoiceId);
        assert(watchedState === true || watchedState === false);
        assert(cb);
        this.findById(invoiceId, (findErr, findRes) => {
            if (findErr) return cb(findErr);
            if (findRes.length == 0) return cb(`invoice ${invoiceId} not found`);
            const [ invoice ] = findRes;
            db.update(
                'invoice',
                { _id: db.id(invoiceId) },
                { updated: new Date(), watched: watchedState },
                (result) => {
                    history.create(invoiceId, null, {
                        invoiceId,
                        action: 'setWatchedState',
                        watchedState: watchedState,
                    }, `watchedState -> ${watchedState ? 'true' : 'false'}`, () => cb(null));
                }
            );
        });
    },
    /**
     * Update status. Available modes:
     * - unpaid, partial, paid, overpaid,
     *   pending_partial, pending_paid, pending_overpaid
     */
    updateStatus(invoiceId, newStatus, cb) {
        assert(invoiceId);
        assert(newStatus);
        this.findById(invoiceId, (findErr, findRes) => {
            if (findErr) return cb(findErr);
            if (findRes.length == 0) return cb(`invoice ${invoiceId} not found`);
            if (findRes[0].status === newStatus) return cb(null, false);
            db.update(
                'invoice',
                { _id: db.id(invoiceId) },
                { updated: new Date(), status: newStatus },
                (result) => {
                    history.create(invoiceId, null, {
                        invoiceId,
                        newStatus,
                        action: 'updateStatus',
                    }, `status -> ${newStatus}`, () => {
                        history.find(invoiceId, null, () => cb(null, newStatus));
                    });
                }
            );
        });
    },
    find(q, s, cb) {
        if (!cb) {
            cb = s;
            s = null;
        }
        assert(cb);
        db.find('invoice', q, s, cb);
    },
    findByAddr(addr, cb) {
        assert(addr);
        this.find({ addr }, cb);
    },
    findById(id, cb) {
        assert(id);
        this.find({ _id: db.id(id) }, cb);
    },
};

module.exports = model;
