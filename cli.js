const model = {
    state: require('./models/state'),
};
const assert = require('assert');
const utils = require('./utils');
const deasync = require('deasync');
const payment = require('./payment');

const API = require('./api');

const { rpad } = utils;

const run = (cmd, ...args) => CLI[cmd](cmd, ...args);

const CLI = {
    /**
     * Prepend a callback B to the done callback, so that
     * (before) A
     * (after)  B, A
     */
    _postSignal(cb) {
        assert(cb);
        const dcb = CLI.doneCallback;
        CLI.doneCallback = (...args) => {
            cb(...args);
            dcb(...args);
        };
    },
    _reset() {
        CLI.doneCallback = () => {};
    },
    help(_) {
        console.log('available commands:');
        console.log('  create <amount> <content> Create a new invoice for <amount> bit coins, its contents described in <content>.')
        console.log('  list [<since>]            List all invoices updated after `since`. If no `since` is provided, lists all invoices in the system.');
        console.log('  info <invoiceid>          Display info about the given invoice.');
        console.log('  updates                   List all invoices that were updated since the last call.');
        CLI.doneCallback();
    },
    /**
     * Create a new invoice.
     * Syntax: create <amount> <content>
     * Example: create 0.001 "A pair of socks."
     */
    create(_, amountBTC, content) {
        API.create(amountBTC, content, () => CLI.doneCallback());
    },
    /**
     * List all invoices updated after `since` (optional; if unset, lists
     * all invoices).
     */
    list(_, since) {
        let found = false;
        console.log(`${rpad('invoice:', 31)} ${rpad('amount:', 7)} ${rpad('status:', 15)} ${rpad('conf:', 10)} pending:`);
        API.iterInvoices(
            since,
            (invoice, state, callback) => {
                found = true;
                console.log(`${rpad(''+invoice._id, 31)} \
${rpad(utils.btcFromSatoshi(invoice.amount), 7)} \
${rpad(state.updated || invoice.status, 15)} \
${rpad(utils.btcFromSatoshi(state.finalAmount) + ' BTC', 10)} \
${utils.btcFromSatoshi(state.pendingAmount)} BTC`[invoice.status === 'paid' ? 'green' : 'red']);
                callback();
            },
            () => {
                if (!found) console.log('                     - no invoices found -'.yellow);
                CLI.doneCallback();
            }
        );
    },
    /**
     * Get info about a given invoice.
     */
    info(_, invoiceid) {
        API.info(invoiceid, (err, { invoice, state }) => {
            if (err) {
                console.log(`Error: ${err}`);
            } else {
                utils.kvpPrint([
                    'Invoice:         ', invoice._id,
                    'Status:          ', invoice.status,
                    'Bitcoin Address: ', invoice.addr,
                    'Watched:         ', invoice.watched ? `true (${state.confirmations} confirmation${state.confirmations === 1 ? '' : 's'})` : 'false',
                    '',
                    'Amount:          ', `${utils.btcFromSatoshi(invoice.amount)} BTC`,
                    'Received:        ', `${utils.btcFromSatoshi(state.finalAmount)} BTC`,
                ]);
                if (state.pendingAmount) utils.kvpPrint([
                    'Pending:         ', `${utils.btcFromSatoshi(state.pendingAmount)} BTC`,
                ]);
                if (state.disabledAmount)
                    console.log(`Reorg:           ${utils.btcFromSatoshi(state.disabledAmount)} BTC`.red);
                utils.kvpPrint([
                    '',
                    'Content:         ', invoice.content,
                    '',
                    'Created:         ', invoice.created,
                    'Last updated:    ', invoice.updated,
                ]);
                const { payments } = state;
                if (payments.length > 0) {
                    console.log('\nHistory:');
                    for (const pmt of payments) {
                        console.log(`${pmt.txid.cyan}: ${payment.paymentStatusWithColor(pmt.status)}`);
                        console.log(`- ${pmt.amount} BTC`);
                    }
                }
            }
            CLI.doneCallback();
        });
    },
    /**
     * Show updates since last check.
     */
    updates() {
        this._postSignal(() => {
            deasync((cb) => model.state.set('lastupdated', new Date(), cb))();
        });
        model.state.get('lastupdated', (lu) => run('list', lu));
    },
};
CLI.doneCallback = () => {};

module.exports = CLI;
