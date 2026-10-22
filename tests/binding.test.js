import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, reseal, fakeChain } from './helpers.js';
import { verifyBundle } from '../src/bundle.js';

test('removing all liability witnesses cannot detach the total from asset signatures', async () => {
  const { bundle, balances } = fixture();
  bundle.liabilities.disclosed_leaves = [];
  bundle.liabilities.root.sum = 0;
  reseal(bundle);
  const result = await verifyBundle(bundle, { chain: fakeChain({ balances }) });
  assert.equal(result.ok, false);
});

test('malformed bundle input returns a failed check rather than throwing', async () => {
  for (const value of [null, [], { format: 'tpor-bundle/v1' }]) {
    assert.equal((await verifyBundle(value)).ok, false);
  }
});

test('negative asset claims and prices cannot produce a positive solvency report', async () => {
  const { bundle } = fixture();
  for (const p of bundle.assets.proofs) p.claimed_sats *= -1;
  bundle.price.usd_cents_per_btc *= -1;
  reseal(bundle);
  assert.equal((await verifyBundle(bundle)).ok, false);
});

test('invalid freshness policy is rejected even for a fresh snapshot', async () => {
  const { bundle, balances } = fixture();
  for (const maxAgeBlocks of [NaN, Infinity, -1, 1.5]) {
    assert.equal((await verifyBundle(bundle, { chain: fakeChain({ balances }), maxAgeBlocks })).ok, false);
  }
});

test('a single-leaf root cannot have its sum lowered while retaining its signed hash', async () => {
  const { bundle } = fixture();
  const leaf = bundle.liabilities.disclosed_leaves[0].leaf;
  const single = fixture({ liab: [leaf] }).bundle;
  single.liabilities.root.sum = 0;
  reseal(single);
  assert.equal((await verifyBundle(single)).ok, false);
});

test('unsafe, fractional and nonnumeric external amounts fail closed', async () => {
  for (const value of [Number.MAX_SAFE_INTEGER + 1, 1.5, '100', null]) {
    const { bundle } = fixture();
    bundle.assets.proofs[0].claimed_sats = value;
    assert.equal((await verifyBundle(bundle)).ok, false);
  }
});
