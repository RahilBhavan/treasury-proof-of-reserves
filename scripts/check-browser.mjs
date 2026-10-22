// Execute the real browser artifact without Node globals or network access.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';
const context = { TextEncoder, TextDecoder, crypto: webcrypto, console, setTimeout, clearTimeout };
runInNewContext(readFileSync('web/vendor/por.bundle.js', 'utf8'), context);
const bundle = JSON.parse(readFileSync('examples/bundle.json', 'utf8'));
const result = await context.TPOR.verifyBundle(bundle);
assert.equal(result.ok, true);
assert.equal(result.complete, false);
assert.equal(result.skipped, 3);
assert.deepEqual(Array.from(result.checks.filter((c) => c.status === 'skip'), (c) => c.name), ['block hash at height', 'snapshot freshness', 'balances at height']);
bundle.liabilities.disclosed_leaves = [];
assert.equal((await context.TPOR.verifyBundle(bundle)).ok, false);
assert.equal((await context.TPOR.verifyBundle(null)).ok, false);
console.log('Browser artifact: example passes with 3 skips; missing witnesses and null input fail.');
