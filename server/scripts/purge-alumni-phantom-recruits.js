#!/usr/bin/env node
'use strict';

const { purgeAlumniPhantomRecruits } = require('../lib/purge-alumni-phantom-recruits');

purgeAlumniPhantomRecruits({ clearHubCache: true })
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok === false ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
