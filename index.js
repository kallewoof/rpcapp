#!/usr/bin/env node
const debug = require('./debug');
const db = require('./db');
const bitcoin = require('./bitcoin');
const CLI = require('./cli');
const config = require('./config');
const scanner = require('./scanner');

db.connect((err) => {
    scanner.scan((err) => {
        if (err) {
            console.log(`Failed to update state: ${err}`);
            return process.exit(1);
        }
        const args = process.argv.slice(2);
        const cmd = args[0] || 'help';
        // command
        if (CLI[cmd]) {
            CLI._postSignal(() => process.exit(1));
            CLI[cmd](...args);
        } else {
            console.log(`error: unknown command: ${cmd}`);
            process.exit(1);
        }
    });
});
