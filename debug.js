const debug = require('debug')('rpcapp');

let lastreps = 0;
let lastargs = 0;
let last = null;
const safestringify = (arr) => {
    let res;
    try {
        res = JSON.stringify(arr);
    } catch (e) {
        res = [];
        for (const v of arr) {
            let r;
            try {
                r = JSON.stringify(v);
            } catch (e2) {
                r = '[ob]';
            }
            res.push(r);
        }
    }
    return res;
}
module.exports = (...msg) => {
    const j = safestringify(msg);
    if (lastargs === msg.length) {
        if (j === last) {
            lastreps++;
            return;
        }
    } else lastargs = msg.length;
    last = j;
    if (lastreps > 0) debug(`  [repeats ${lastreps} time(s)]`);
    lastreps = 0;
    debug(...msg);
};
