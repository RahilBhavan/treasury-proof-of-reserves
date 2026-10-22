// Deterministic attacks on the committed fictional fixture. No node or keys.
import { verifyBundle, computeCommitments, computeReport, bundleDigest, DEFAULT_MAX_AGE_BLOCKS } from '../src/bundle.js';

export const CHAIN_SKIPS = ['block hash at height', 'snapshot freshness', 'balances at height'];

function reseal(bundle) {
  bundle.assets.total_claimed_sats = bundle.assets.proofs.reduce((sum, p) => sum + p.claimed_sats, 0);
  bundle.commitments = computeCommitments(bundle);
  bundle.report = computeReport(bundle.assets.total_claimed_sats, bundle.liabilities.root.sum, bundle.price.usd_cents_per_btc);
  bundle.bundle_digest = bundleDigest(bundle);
}

export async function runAdversarialDemo(original) {
  // Observations come from the ORIGINAL fixture, never from an attacked copy.
  // This demonstrates verifier behavior; it is not independent chain evidence.
  const { height, block_hash: hash } = original.snapshot;
  const observations = new Map(original.assets.proofs.map((p) => [p.address, p.claimed_sats]));
  const address = original.assets.proofs[0].address;
  const simulatedChain = (tip) => ({
    async getBlockHash(h) {
      if (h !== height) throw new Error(`simulation only defines height ${height}`);
      return hash;
    },
    async getTipHeight() { return tip; },
    async balancesAtHeight(addresses, h) {
      if (h !== height) throw new Error(`simulation only defines height ${height}`);
      return new Map(addresses.map((a) => [a, observations.get(a) ?? 0]));
    },
  });
  const inflate = (b) => { b.assets.proofs[0].claimed_sats += 100000000; reseal(b); };
  const cases = [
    { id: 'fresh-at-limit', note: 'Simulated tip is exactly 144 blocks after the snapshot.', tip: height + DEFAULT_MAX_AGE_BLOCKS },
    { id: 'offline-baseline', note: 'Original fixture; no chain evidence.', offline: true },
    { id: 'altered-balance', note: 'Add 1 BTC to the first claim and recompute all public hashes and report.', mutate: inflate,
      failures: [`balance ${address}`] },
    { id: 'altered-balance-offline', note: 'Same resealed inflation; offline verification cannot detect it.', mutate: inflate, offline: true },
    { id: 'missing-witnesses', note: 'Remove all witnesses, lower liabilities to zero, recompute public hashes and report.',
      mutate(b) { b.liabilities.disclosed_leaves = []; b.liabilities.root.sum = 0; reseal(b); }, failures: ['liabilities root'] },
    { id: 'invalid-signature', note: 'Use address B signature for address A, then recompute public hashes.',
      mutate(b) { b.assets.proofs[0].signature = b.assets.proofs[1].signature; reseal(b); },
      failures: [`signature ${address}`, 'assets >= liabilities'] },
    { id: 'stale-evidence', note: 'Simulated tip is 145 blocks after the unchanged snapshot.', tip: height + DEFAULT_MAX_AGE_BLOCKS + 1,
      failures: ['snapshot freshness'] },
    { id: 'stale-evidence-offline', note: 'Same snapshot without a chain; age cannot be established.', offline: true },
    { id: 'invalid-chain-tip', note: 'Adapter returns NaN rather than a valid height; must fail closed.', tip: NaN, failures: ['chain query'] },
  ];
  const scenarios = [];
  for (const scenario of cases) {
    const bundle = structuredClone(original);
    scenario.mutate?.(bundle);
    const result = await verifyBundle(bundle, {
      chain: scenario.offline ? null : simulatedChain(scenario.tip ?? height + 1),
      maxAgeBlocks: DEFAULT_MAX_AGE_BLOCKS,
    });
    const expected = { failures: scenario.failures ?? [], skips: scenario.offline ? CHAIN_SKIPS : [] };
    const failures = result.checks.filter((c) => c.status === 'fail').map((c) => c.name);
    const skips = result.checks.filter((c) => c.status === 'skip').map((c) => c.name);
    const matches = JSON.stringify(failures) === JSON.stringify(expected.failures)
      && JSON.stringify(skips) === JSON.stringify(expected.skips)
      && result.ok === (expected.failures.length === 0)
      && result.complete === (expected.failures.length === 0 && expected.skips.length === 0);
    scenarios.push({ id: scenario.id, note: scenario.note, expected, matches, result });
  }
  return {
    format: 'tpor-adversarial-demo/v1',
    evidence: 'SIMULATED chain observations copied from the original fictional regtest fixture; not independent node verification.',
    max_age_blocks: DEFAULT_MAX_AGE_BLOCKS,
    matched: scenarios.every((s) => s.matches),
    scenarios,
  };
}
