#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const gate = require('../lib/app-store-stability-gate');

const snap = gate.buildSnapshot({ healthReady: process.argv.includes('--not-ready') ? false : true });
console.log(JSON.stringify(snap, null, 2));
process.exit(snap.evaluation.green ? 0 : 1);