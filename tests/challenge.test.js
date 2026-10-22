import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChallenge, parseChallenge } from '../src/challenge.js';

const fields = { entity: 'Co', network: 'regtest', height: 7, block_hash: 'ab'.repeat(32), liabilities_root: 'cd'.repeat(32), nonce: 'n' };

test('challenge round-trips', () => {
  assert.deepEqual(parseChallenge(buildChallenge(fields)), fields);
});

test('fields cannot smuggle extra lines', () => {
  assert.throws(() => buildChallenge({ ...fields, entity: 'Co\nheight: 1' }), /newline/);
  assert.throws(() => buildChallenge({ ...fields, block_hash: 'XY' }), /block_hash/);
  assert.throws(() => parseChallenge(buildChallenge(fields) + '\nextra: 1'), /wrong format/);
});
