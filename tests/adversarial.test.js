import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runAdversarialDemo, CHAIN_SKIPS } from '../scripts/adversarial-cases.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('../examples/bundle.json', import.meta.url), 'utf8'));

test('adversarial CLI is deterministic, checks all nine scenarios, and runs without a node', () => {
  const run = () => execFileSync(process.execPath, ['scripts/adversarial-demo.mjs', '--json'], { cwd: root, encoding: 'utf8' });
  const first = run();
  assert.equal(first, run());
  const demo = JSON.parse(first);
  assert.equal(demo.matched, true);
  assert.equal(demo.scenarios.length, 9);
  const cases = Object.fromEntries(demo.scenarios.map((s) => [s.id, s.result]));
  assert.equal(cases['fresh-at-limit'].complete, true);
  assert.match(cases['fresh-at-limit'].checks.find((c) => c.name === 'snapshot freshness').detail, /^144 blocks old/);
  assert.match(cases['stale-evidence'].checks.find((c) => c.name === 'snapshot freshness').detail, /145 blocks old/);
  assert.equal(cases['altered-balance'].ok, false);
  for (const name of ['commitments', 'report arithmetic', 'bundle digest']) {
    assert.equal(cases['altered-balance'].checks.find((c) => c.name === name).status, 'pass');
  }
  for (const id of ['offline-baseline', 'altered-balance-offline', 'stale-evidence-offline']) {
    assert.equal(cases[id].ok, true);
    assert.equal(cases[id].complete, false);
    assert.deepEqual(cases[id].checks.filter((c) => c.status === 'skip').map((c) => c.name), CHAIN_SKIPS);
  }
  for (const id of ['missing-witnesses', 'invalid-signature', 'stale-evidence', 'invalid-chain-tip']) {
    assert.equal(cases[id].ok, false);
    assert.equal(cases[id].complete, false);
  }
});

test('demo detects unexpected failures and leaves the original fixture unchanged', async () => {
  const original = structuredClone(fixture);
  await runAdversarialDemo(fixture);
  assert.deepEqual(fixture, original);
  const broken = structuredClone(fixture);
  broken.liabilities.disclosed_leaves[0].leaf.notional_usd_cents += 1;
  const demo = await runAdversarialDemo(broken);
  assert.equal(demo.matched, false);
  assert.equal(demo.scenarios.find((s) => s.id === 'offline-baseline').matches, false);
  // This attack removes the corrupted witness, so its original expectation still matches.
  assert.equal(demo.scenarios.find((s) => s.id === 'missing-witnesses').matches, true);
});

test('human output distinguishes expected rejections from demo success; unknown flags fail', () => {
  const output = execFileSync(process.execPath, ['scripts/adversarial-demo.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /SIMULATED chain observations/);
  assert.match(output, /FAIL signature/);
  assert.match(output, /SKIP snapshot freshness/);
  assert.match(output, /PASS demo assertions: 9\/9/);
  const invalid = spawnSync(process.execPath, ['scripts/adversarial-demo.mjs', '--unknown'], { cwd: root, encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /usage:/);
});
