#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { purgeStaffPhantomRecruits } = require('../lib/purge-staff-phantom-recruits');

purgeStaffPhantomRecruits({ clearHubCache: true })
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    if (report?.ok === false) process.exit(1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
