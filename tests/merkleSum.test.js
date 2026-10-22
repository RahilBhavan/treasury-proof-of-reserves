import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, verifyInclusion, leafHash } from '../src/merkleSum.js';
import { liabilities } from './helpers.js';

test('every leaf proves inclusion, and the root sum is the total notional', () => {
  for (const n of [1, 2, 3, 5, 8]) {
    const leaves = Array.from({ length: n }, (_, i) => ({ ...liabilities()[0], id: `L${i}`, notional_usd_cents: (i + 1) * 100 }));
    const { root, proofs } = buildTree(leaves);
    assert.equal(root.sum, (n * (n + 1) / 2) * 100);
    assert.equal(root.leaf_count, n);
    leaves.forEach((l, i) => assert.equal(verifyInclusion(l, proofs[i], root), true));
  }
});

test('a proof for one leaf does not verify a different leaf', () => {
  const leaves = liabilities();
  const { root, proofs } = buildTree(leaves);
  assert.throws(() => verifyInclusion(leaves[1], proofs[0], root), /root hash does not match/);
});

test('child sums are committed separately: moving value between siblings changes the hash', () => {
  // Under a parent-sum-only hash, (80, 40) and (100, 20) would hash alike.
  const leaves = liabilities();
  const { root, proofs } = buildTree(leaves);
  const p = structuredClone(proofs[0]);
  p.path[0].sum += 20000000;
  const shifted = { ...leaves[0], notional_usd_cents: leaves[0].notional_usd_cents - 20000000 };
  assert.throws(() => verifyInclusion(shifted, p, root));
});

test('negative or non-integer sibling sums are rejected', () => {
  const leaves = liabilities();
  const { root, proofs } = buildTree(leaves);
  for (const bad of [-1, 1.5]) {
    const p = structuredClone(proofs[0]);
    p.path[1].sum = bad;
    assert.throws(() => verifyInclusion(leaves[0], p, root), /negative or not an integer/);
  }
});

test('the salt hides the leaf: same notional, different salt, different hash', () => {
  const [a] = liabilities();
  const b = { ...a, salt: '11'.repeat(32) };
  assert.notDeepEqual(leafHash(a), leafHash(b));
});

test('malformed leaves and duplicate ids are refused at build time', () => {
  const [a] = liabilities();
  assert.throws(() => buildTree([a, { ...a }]), /duplicate liability id/);
  assert.throws(() => buildTree([{ ...a, notional_usd_cents: -5 }]), /non-negative/);
  assert.throws(() => buildTree([{ ...a, kind: 'customer_deposit' }]), /unknown kind/);
  assert.throws(() => buildTree([{ ...a, extra: 1 }]), /exactly the fields/);
  assert.throws(() => buildTree([]), /at least one/);
});
