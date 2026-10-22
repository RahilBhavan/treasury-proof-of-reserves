// End-to-end verifier behavior on bundles, with an in-memory chain source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyBundle } from '../src/bundle.js';
import { buildChallenge } from '../src/challenge.js';
import { generateKey, signChallenge } from '../src/prove.js';
import { fixture, fakeChain, reseal, clone, failed, HEIGHT, liabilities } from './helpers.js';

test('a valid bundle passes every check against the chain', async () => {
  const { bundle, balances } = fixture();
  const r = await verifyBundle(bundle, { chain: fakeChain({ balances }) });
  assert.deepEqual(failed(r), []);
  assert.equal(r.complete, true);
  assert.equal(bundle.report.solvent, true);
  assert.equal(bundle.report.coverage_bps, 12500); // 17.5 BTC at $100k = $1.75M vs $1.4M
});

test('offline verification marks chain checks as skipped, not passed', async () => {
  const { bundle } = fixture();
  const r = await verifyBundle(bundle);
  assert.equal(r.ok, true);
  assert.equal(r.complete, false);
  assert.equal(r.skipped, 3);
});

test('tampered leaf: changing a disclosed notional breaks its inclusion proof', async () => {
  const { bundle, balances } = fixture();
  const b = clone(bundle);
  b.liabilities.disclosed_leaves[1].leaf.notional_usd_cents -= 1;
  const r = await verifyBundle(b, { chain: fakeChain({ balances }) });
  assert.deepEqual(failed(r), ['inclusion PREF-A']);
});

test('tampered leaf: changing a label or salt also breaks inclusion', async () => {
  const { bundle } = fixture();
  const b = clone(bundle);
  b.liabilities.disclosed_leaves[0].leaf.label = 'something else';
  b.liabilities.disclosed_leaves[2].leaf.salt = '00'.repeat(32);
  const r = await verifyBundle(b);
  assert.deepEqual(failed(r), ['inclusion CVT-A', 'inclusion LOAN-A']);
});

test('tampered sum: lowering the published root total is caught even if the prover reseals the bundle', async () => {
  const { bundle, balances } = fixture();
  const b = clone(bundle);
  b.liabilities.root.sum -= 20000000; // hide the term loan from the total
  reseal(b);
  const r = await verifyBundle(b, { chain: fakeChain({ balances }) });
  assert.ok(failed(r).includes('inclusion CVT-A'));
  assert.ok(failed(r).includes('inclusion LOAN-A'));
  assert.equal(r.ok, false);
});

test('tampered sum: lowering a sibling sum inside a proof changes the recomputed root hash', async () => {
  const { bundle } = fixture();
  const b = clone(bundle);
  b.liabilities.disclosed_leaves[0].proof.path[0].sum = 0;
  const r = await verifyBundle(b);
  assert.deepEqual(failed(r), ['inclusion CVT-A']);
  assert.match(r.checks.find((c) => c.name === 'inclusion CVT-A').detail, /root hash does not match/);
});

test('tampered report: an edited solvency figure fails arithmetic and digest checks', async () => {
  const { bundle } = fixture();
  const b = clone(bundle);
  b.report.assets_usd_cents *= 2;
  const r = await verifyBundle(b);
  assert.deepEqual(failed(r), ['report arithmetic', 'bundle digest']);
});

test('tampered price: changing the committed price fails the commitment check', async () => {
  const { bundle } = fixture();
  const b = clone(bundle);
  b.price.usd_cents_per_btc *= 10;
  const r = await verifyBundle(b);
  assert.ok(failed(r).includes('commitments'));
});

test('wrong challenge: signatures over a different block hash do not verify', async () => {
  const { bundle, keys, balances } = fixture();
  const other = buildChallenge({
    entity: 'Test Co', network: 'regtest', height: HEIGHT, block_hash: 'cd'.repeat(32),
    liabilities_root: bundle.liabilities.root.hash, nonce: 'n1',
  });
  const b = clone(bundle);
  b.assets.proofs[0].signature = signChallenge(keys[0], other);
  reseal(b);
  const r = await verifyBundle(b, { chain: fakeChain({ balances }) });
  assert.deepEqual(failed(r), [`signature ${keys[0].address}`, 'assets >= liabilities']);
});

test('wrong challenge: editing the challenge text invalidates every signature', async () => {
  const { bundle, keys } = fixture();
  const b = clone(bundle);
  b.challenge = b.challenge.replace(/nonce: .*/, 'nonce: replayed');
  reseal(b);
  const r = await verifyBundle(b);
  for (const k of keys) assert.ok(failed(r).includes(`signature ${k.address}`));
});

test('wrong challenge: a challenge for another height does not match the snapshot', async () => {
  const { bundle } = fixture();
  const b = clone(bundle);
  b.snapshot.height = HEIGHT - 1;
  const r = await verifyBundle(b);
  assert.ok(failed(r).includes('challenge matches snapshot'));
});

test('signature from the wrong key: a valid signature by key B is rejected for address A', async () => {
  const { bundle, keys, balances } = fixture();
  const intruder = generateKey('p2wpkh');
  const b = clone(bundle);
  b.assets.proofs[1].signature = signChallenge(intruder, b.challenge);
  reseal(b);
  const r = await verifyBundle(b, { chain: fakeChain({ balances }) });
  assert.deepEqual(failed(r), [`signature ${keys[1].address}`, 'assets >= liabilities']);
});

test('signature from the wrong key: taproot address with a P2WPKH key signature', async () => {
  const { bundle, keys } = fixture();
  const b = clone(bundle);
  b.assets.proofs[2].signature = b.assets.proofs[0].signature;
  reseal(b);
  const r = await verifyBundle(b);
  assert.ok(failed(r).includes(`signature ${keys[2].address}`));
});

test('stale block height: a snapshot older than the freshness policy fails', async () => {
  const { bundle, balances } = fixture();
  const r = await verifyBundle(bundle, { chain: fakeChain({ tip: HEIGHT + 145, balances }), maxAgeBlocks: 144 });
  assert.deepEqual(failed(r), ['snapshot freshness']);
  const ok = await verifyBundle(bundle, { chain: fakeChain({ tip: HEIGHT + 144, balances }), maxAgeBlocks: 144 });
  assert.deepEqual(failed(ok), []);
});

test('stale or reorged block: a different hash at the snapshot height fails', async () => {
  const { bundle, balances } = fixture();
  const r = await verifyBundle(bundle, { chain: fakeChain({ hashes: { [HEIGHT]: 'ee'.repeat(32) }, balances }) });
  assert.deepEqual(failed(r), ['block hash at height']);
});

test('future height: a snapshot above the chain tip fails', async () => {
  const { bundle, balances } = fixture();
  const r = await verifyBundle(bundle, { chain: fakeChain({ tip: HEIGHT - 1, balances }) });
  assert.deepEqual(failed(r), ['snapshot freshness']);
});

test('duplicate address: the same address listed twice is rejected', async () => {
  const k = generateKey('p2wpkh');
  const { bundle, balances } = fixture({ keys: [k, k, generateKey('p2tr')] });
  const r = await verifyBundle(bundle, { chain: fakeChain({ balances }) });
  assert.ok(failed(r).includes('no duplicate addresses'));
});

test('duplicate address: an upper-case bech32 copy of the same script is rejected', async () => {
  const { bundle, keys } = fixture();
  const b = clone(bundle);
  b.assets.proofs.push({ ...b.assets.proofs[0], address: keys[0].address.toUpperCase() });
  reseal(b);
  const r = await verifyBundle(b);
  assert.match(r.checks.find((c) => c.name === 'no duplicate addresses').detail, /same output script/);
});

test('balance mismatch: claiming more than the chain shows at the height fails', async () => {
  const { bundle, keys, balances } = fixture();
  const chainBalances = new Map(balances);
  chainBalances.set(keys[0].address, 0); // coins moved before the snapshot block
  const r = await verifyBundle(bundle, { chain: fakeChain({ balances: chainBalances }) });
  assert.deepEqual(failed(r), [`balance ${keys[0].address}`]);
});

test('insolvent: assets below liabilities fail the final check with signatures intact', async () => {
  const liab = liabilities();
  liab[0].notional_usd_cents = 900000000; // $9.6M of liabilities vs $1.75M of bitcoin at the test price
  const { bundle, balances } = fixture({ liab });
  const r = await verifyBundle(bundle, { chain: fakeChain({ balances }) });
  assert.deepEqual(failed(r), ['assets >= liabilities']);
  assert.equal(bundle.report.solvent, false);
});

test('unknown bundle format is rejected', async () => {
  const { bundle } = fixture();
  const r = await verifyBundle({ ...bundle, format: 'other' });
  assert.equal(r.ok, false);
});
