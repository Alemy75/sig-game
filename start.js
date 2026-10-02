'use strict';
require('./svoya-igra/start.js').start().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
