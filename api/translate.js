'use strict';

/* Vercel serverless entrypoint — same handler as the Firebase Cloud
 * Function (functions/index.js wraps functions/translate.js). */
module.exports = require('../functions/translate');
module.exports.handler = module.exports;
