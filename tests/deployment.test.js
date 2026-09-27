'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { signUpload } = require('../functions/cloudinary');
const firebase = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
assert.equal(firebase.hosting.public, 'dist');
assert.deepEqual(firebase.hosting.predeploy, ['npm run build:vercel']);
assert.equal(firebase.firestore.rules, 'firestore.rules');
assert.equal(firebase.functions[0].runtime, 'nodejs22');

// Test upload-filter behavior, rather than merely looking for strings.
for (const file of ['functions/share.js', 'functions/translate.js', 'scripts/build-vercel.mjs',
  'scripts/install-functions.mjs', 'package-lock.json', ...fs.readdirSync('api').map(name => `api/${name}`)]) {
  const result = spawnSync('git', ['-c', 'core.excludesFile=.vercelignore', 'check-ignore', '--no-index', file]);
  assert.equal(result.status, 1, `${file} must survive the Vercel upload filter: ${result.stderr}`);
}
assert.equal(signUpload({ timestamp: 1315060510, public_id: 'sample_image' }, 'abcd'),
  'b4ad47fb4e25c7bf5f92a20089f9db59bc302313');
assert.equal(signUpload({ b: 'two', a: 'one' }, 'secret'), signUpload({ a: 'one', b: 'two' }, 'secret'));
const functionsSource = fs.readFileSync('functions/index.js', 'utf8');
assert(!functionsSource.includes('functions.config()'), 'Retired Runtime Config API must not return');
assert(functionsSource.includes('secrets: [cloudinaryApiSecret]'));
assert(!functionsSource.includes('data.upload_preset') && !functionsSource.includes('data.folder'));
console.log('Deployment packaging and upload-signature regression checks passed.');
