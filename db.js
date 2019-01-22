const debug = require('./debug');
const { MongoClient, ObjectID } = require('mongodb');
const assert = require('assert');

const url = 'mongodb://localhost:27017/test';

module.exports = {
    id(id) {
        return new ObjectID(id);
    },
    connect(cb) {
        assert(!this.connected);
        MongoClient.connect(url, (err, db) => {
            assert.equal(null, err);
            this.connected = true;
            this.db = db;
            cb(err);
        });
    },
    disconnect() {
        assert(this.connected);
        this.db.close();
        this.connected = false;
        this.db = null;
    },
    insert(coll, obj, cb) {
        debug('%s.insert %s', coll, JSON.stringify(obj));
        return this.db.collection(coll).insert(obj, cb);
    },
    find(coll, query, sort, cb) {
        if (!cb) {
            cb = sort;
            sort = null;
        }
        const cursor = this.db.collection(coll).find(query);
        if (sort) cursor.sort(sort);
        cursor.toArray(cb);
        debug(`${coll}.find ${JSON.stringify(query)}`);
    },
    update(coll, query, set, cb = null) {
        debug(`${coll}.update ${JSON.stringify(query)}: set ${JSON.stringify(set)}`);
        this.db.collection(coll).update(
            query,
            {
                $set: set,
                $currentDate: { "lastModified": true },
            },
            cb
        );
    },
    upsert(coll, query, set, cb = null) {
        debug(`${coll}.upsert ${JSON.stringify(query)}: set ${JSON.stringify(set)}`);
        this.db.collection(coll).update(
            query,
            {
                $set: set,
                $currentDate: { "lastModified": true },
            },
            {
                upsert: true,
            },
            cb
        );
    },
    remove(coll, query, cb = null) {
        debug(`${coll}.remove ${JSON.stringify(query)}`);
        this.db.collection(coll).remove(query, (err, results) => {
            if (cb)
                cb(err, results);
            else
                assert.equal(null, err);
        });
    },
};
