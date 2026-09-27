'use strict';
const { createHash } = require('node:crypto');

// Cloudinary signs alphabetically sorted key=value pairs, not JSON.
function signUpload(params, secret) {
  const canonical = Object.keys(params).sort()
    .map(key => `${key}=${params[key]}`).join('&');
  return createHash('sha1').update(canonical + secret).digest('hex');
}
module.exports = { signUpload };
