import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyBundle } from '../src/bundle.js';

const bundle = JSON.parse(readFileSync(new URL('../examples/bundle.json', import.meta.url), 'utf8'));
const balances = new Map(bundle.assets.proofs.map((p) => [p.address, p.claimed_sats]));

test('invalid external chain tip cannot establish snapshot freshness', async () => {
  for (const tip of [NaN, Infinity, -1, 1.5, String(bundle.snapshot.height), null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    const result = await verifyBundle(bundle, { chain: {
      async getBlockHash() { return bundle.snapshot.block_hash; },
      async getTipHeight() { return tip; },
      async balancesAtHeight() { return balances; },
    } });
    assert.equal(result.ok, false, `tip ${String(tip)} must fail closed`);
    assert.equal(result.complete, false);
    assert.equal(result.checks.some((c) => c.name === 'snapshot freshness' && c.status === 'pass'), false);
    assert.ok(result.checks.some((c) => c.status === 'fail' && /tip height/.test(c.detail)));
  }
});
