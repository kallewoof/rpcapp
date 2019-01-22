const async = require('async');

function EventSource(obj) {
    this.listeners = {};
    this.listeneriter = 0;
    obj.listen = (signal, callback) => this.listen(signal, callback);
    obj.unlisten = (signal, lid) => this.unlisten(signal, lid);
    obj.sig = (signal, args) => this.sig(signal, args);
}

EventSource.prototype = {
    listen(signal, callback) {
        this.listeneriter++;
        if (!this.listeners[signal]) this.listeners[signal] = [];
        const r = {};
        r[this.listeneriter] = callback;
        this.listeners[signal].push(r);
        return this.listeneriter;
    },
    unlisten(signal, lid) {
        delete this.listeners[signal][lid];
    },
    sig(signal, args, cb) {
        const kv = this.listeners[signal];
        if (!kv) return cb ? cb() : null;
        const v = Object.values(kv);
        if (!v) return cb ? cb() : null;
        async.eachSeries(
            v,
            (val, asyncCallback) => {
                if (val)
                    val(args, asyncCallback);
                else 
                    asyncCallback();
            },
            cb
        );
    },
};

module.exports = {
    EventSource,
};
