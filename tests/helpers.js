// Shared fixtures: a valid bundle on regtest-format addresses and an in-memory chain.
import { generateKey, buildBundle, randomHex } from '../src/prove.js';
import { computeCommitments, computeReport, bundleDigest } from '../src/bundle.js';

export const HEIGHT = 500;
export const BLOCK_HASH = 'ab'.repeat(32);
export const PRICE = { usd_cents_per_btc: 10000000, source: 'test constant', as_of: 'test' };

export function liabilities() {
  return [
    { id: 'CVT-A', kind: 'convertible_note', label: 'note A', notional_usd_cents: 80000000, salt: randomHex() },
    { id: 'PREF-A', kind: 'preferred_stock', label: 'pref A', notional_usd_cents: 40000000, salt: randomHex() },
    { id: 'LOAN-A', kind: 'term_loan', label: 'loan A', notional_usd_cents: 20000000, salt: randomHex() },
  ];
}

export function fixture({ keys, amounts = [1000000000, 500000000, 250000000], liab = liabilities(), height = HEIGHT, block_hash = BLOCK_HASH } = {}) {
  keys = keys || [generateKey('p2wpkh'), generateKey('p2wpkh'), generateKey('p2tr')];
  const balances = new Map();
  keys.forEach((k, i) => balances.set(k.address, (balances.get(k.address) ?? 0) + amounts[i]));
  const bundle = buildBundle({
    entity: 'Test Co', network: 'regtest', height, block_hash, keys, balances,
    liabilities: liab, disclose: 'all', price: PRICE,
  });
  return { keys, balances, bundle };
}

// In-memory chain: fixed tip, block hashes and balances.
export function fakeChain({ tip = HEIGHT + 1, hashes = { [HEIGHT]: BLOCK_HASH }, balances }) {
  return {
    async getTipHeight() { return tip; },
    async getBlockHash(h) { if (!(h in hashes)) throw new Error(`no block ${h}`); return hashes[h]; },
    async balancesAtHeight(addresses) { return new Map(addresses.map((a) => [a, balances.get(a) ?? 0])); },
  };
}

// Re-derive commitments, report and digest after an edit, as a dishonest
// prover would, so a test isolates the check it targets.
export function reseal(bundle) {
  bundle.assets.total_claimed_sats = bundle.assets.proofs.reduce((s, p) => s + p.claimed_sats, 0);
  bundle.commitments = computeCommitments(bundle);
  bundle.report = computeReport(bundle.assets.total_claimed_sats, bundle.liabilities.root.sum, bundle.price.usd_cents_per_btc);
  bundle.bundle_digest = bundleDigest(bundle);
  return bundle;
}

export const clone = (x) => structuredClone(x);
export const failed = (result) => result.checks.filter((c) => c.status === 'fail').map((c) => c.name);
