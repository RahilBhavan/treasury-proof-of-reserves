// Proof bundle format and the verifier. Runs in Node and in the browser.
//
// A chain source is optional. Without one, the verifier checks signatures,
// liability proofs, commitments and arithmetic, and marks the on-chain checks
// as skipped rather than passed.
import { validateBundle } from './validateBundle.js';
import { verifySimple } from './bip322.js';
import * as ecc from '@bitcoinerlab/secp256k1';
import { address as btcAddress, initEccLib, networks } from 'bitcoinjs-lib';
import { commit, bytesToHex } from './canonical.js';
import { parseChallenge } from './challenge.js';
import { verifyInclusion } from './merkleSum.js';

initEccLib(ecc); // needed to parse P2TR addresses

export const BUNDLE_FORMAT = 'tpor-bundle/v1';
export const DEFAULT_MAX_AGE_BLOCKS = 144;

const NETWORKS = { regtest: networks.regtest, signet: networks.testnet, testnet: networks.testnet, mainnet: networks.bitcoin };

export function scriptHexFor(addr, network) {
  const net = NETWORKS[network];
  if (!net) throw new Error(`unknown network ${network}`);
  return bytesToHex(btcAddress.toOutputScript(addr, net));
}

export function computeCommitments(bundle) {
  return {
    challenge: commit(bundle.challenge),
    assets: commit(bundle.assets),
    liabilities: commit({ root: bundle.liabilities.root }),
    price: commit(bundle.price),
  };
}

export function computeReport(assetsSats, liabilitiesCents, usdCentsPerBtc) {
  const assetsCents = (BigInt(assetsSats) * BigInt(usdCentsPerBtc)) / 100000000n;
  const liab = BigInt(liabilitiesCents);
  return {
    assets_sats: assetsSats,
    assets_usd_cents: Number(assetsCents),
    liabilities_usd_cents: liabilitiesCents,
    coverage_bps: liab === 0n ? null : Number((assetsCents * 10000n) / liab),
    solvent: assetsCents >= liab,
  };
}

export function bundleDigest(bundle) {
  return commit({ commitments: bundle.commitments, report: bundle.report });
}

class Checks {
  constructor() { this.list = []; }
  pass(name, detail = '') { this.list.push({ name, status: 'pass', detail }); }
  fail(name, detail) { this.list.push({ name, status: 'fail', detail }); }
  skip(name, detail) { this.list.push({ name, status: 'skip', detail }); }
  run(name, fn) {
    try { const d = fn(); this.pass(name, d || ''); return true; }
    catch (e) { this.fail(name, e.message); return false; }
  }
}

// chain: { getTipHeight(), getBlockHash(h), balancesAtHeight(addresses, h) } or null.
export async function verifyBundle(bundle, { chain = null, maxAgeBlocks = DEFAULT_MAX_AGE_BLOCKS } = {}) {
  const c = new Checks();

  if (bundle?.format !== BUNDLE_FORMAT) {
    c.fail('format', `expected ${BUNDLE_FORMAT}, got ${bundle?.format}`);
    return summarize(c);
  }

  if (!c.run('bundle input', () => validateBundle(bundle, maxAgeBlocks))) return summarize(c);

  // 1. Challenge binds network, height, block hash and liabilities root.
  let ch = null;
  c.run('challenge matches snapshot', () => {
    ch = parseChallenge(bundle.challenge);
    const want = {
      entity: bundle.entity, network: bundle.network, height: bundle.snapshot.height,
      block_hash: bundle.snapshot.block_hash, liabilities_root: bundle.liabilities.root.hash,
    };
    for (const [k, v] of Object.entries(want)) {
      if (ch[k] !== v) throw new Error(`challenge ${k} = ${ch[k]}, bundle says ${v}`);
    }
    return `height ${ch.height}, block ${ch.block_hash.slice(0, 16)}...`;
  });

  // 2. Each address appears once (compared by output script, not by string).
  const proofs = bundle.assets.proofs;
  c.run('no duplicate addresses', () => {
    const seen = new Map();
    for (const p of proofs) {
      const s = scriptHexFor(p.address, bundle.network);
      if (seen.has(s)) throw new Error(`${p.address} duplicates ${seen.get(s)} (same output script)`);
      seen.set(s, p.address);
    }
    return `${proofs.length} distinct output scripts`;
  });

  // 3. Each signature is valid for its address over the exact challenge text.
  let sigsOk = true;
  for (const p of proofs) {
    if (verifySimple(p.address, bundle.challenge, p.signature)) c.pass(`signature ${p.address}`, p.format);
    else { sigsOk = false; c.fail(`signature ${p.address}`, 'BIP-322 verification failed for this address and challenge'); }
  }

  // 4. Claimed balances add up.
  const claimedTotal = proofs.reduce((s, p) => s + p.claimed_sats, 0);
  c.run('claimed asset total', () => {
    if (claimedTotal !== bundle.assets.total_claimed_sats) {
      throw new Error(`per-address claims sum to ${claimedTotal}, bundle total is ${bundle.assets.total_claimed_sats}`);
    }
    return `${claimedTotal} sats`;
  });

  // 5. On-chain checks: block hash, freshness, balances at height.
  if (chain) {
    try {
      const h = bundle.snapshot.height;
      const hash = await chain.getBlockHash(h);
      if (hash === bundle.snapshot.block_hash) c.pass('block hash at height', `${h}`);
      else c.fail('block hash at height', `chain has ${hash} at ${h}; bundle says ${bundle.snapshot.block_hash}`);

      const tip = await chain.getTipHeight();
      if (!Number.isSafeInteger(tip) || tip < 0) throw new Error('chain tip height must be a non-negative safe integer');
      const age = tip - h;
      if (age < 0) c.fail('snapshot freshness', `height ${h} is above the chain tip ${tip}`);
      else if (age > maxAgeBlocks) c.fail('snapshot freshness', `snapshot is ${age} blocks old; policy allows ${maxAgeBlocks}`);
      else c.pass('snapshot freshness', `${age} blocks old (limit ${maxAgeBlocks})`);

      const balances = await chain.balancesAtHeight(proofs.map((p) => p.address), h);
      let mismatch = false;
      for (const p of proofs) {
        const actual = balances.get(p.address) ?? 0;
        if (actual !== p.claimed_sats) {
          mismatch = true;
          c.fail(`balance ${p.address}`, `chain shows ${actual} sats at height ${h}; claimed ${p.claimed_sats}`);
        }
      }
      if (!mismatch) c.pass('balances at height', `all ${proofs.length} addresses match the chain`);
    } catch (e) {
      c.fail('chain query', e.message);
    }
  } else {
    c.skip('block hash at height', 'no chain source; run the CLI against a node');
    c.skip('snapshot freshness', 'no chain source');
    c.skip('balances at height', 'claimed balances taken from the bundle, not checked against the chain');
  }

  // 6. Liabilities: every disclosed leaf is included in the root, root sum is sane.
  const root = bundle.liabilities.root;
  c.run('liabilities root', () => {
    // A root hash alone does not authenticate the separately supplied sum.
    // At least one inclusion witness must recompute both from a signed root.
    if (bundle.liabilities.disclosed_leaves.length === 0) throw new Error('at least one liability inclusion witness is required to bind the root sum');
    if (!/^[0-9a-f]{64}$/.test(root.hash)) throw new Error('root hash malformed');
    if (!Number.isSafeInteger(root.sum) || root.sum < 0) throw new Error('root sum malformed');
    return `${root.leaf_count} leaves, total ${root.sum} cents`;
  });
  for (const { leaf, proof } of bundle.liabilities.disclosed_leaves) {
    c.run(`inclusion ${leaf.id}`, () => { verifyInclusion(leaf, proof, root); return leaf.kind; });
  }

  // 7. Commitments and digest recompute from the bundle contents.
  c.run('commitments', () => {
    const want = computeCommitments(bundle);
    for (const k of Object.keys(want)) {
      if (bundle.commitments[k] !== want[k]) throw new Error(`${k} commitment does not match its contents`);
    }
  });

  // 8. Report arithmetic, then the solvency claim itself.
  const report = computeReport(claimedTotal, root.sum, bundle.price.usd_cents_per_btc);
  c.run('report arithmetic', () => {
    for (const k of Object.keys(report)) {
      if (bundle.report[k] !== report[k]) throw new Error(`report.${k} = ${bundle.report[k]}, recomputed ${report[k]}`);
    }
  });
  c.run('bundle digest', () => {
    const d = bundleDigest(bundle);
    if (d !== bundle.bundle_digest) throw new Error(`digest ${bundle.bundle_digest} != recomputed ${d}`);
    return d;
  });
  c.run('assets >= liabilities', () => {
    if (!sigsOk) throw new Error('not evaluated: at least one signature failed');
    if (!report.solvent) throw new Error(`assets ${report.assets_usd_cents} cents < liabilities ${report.liabilities_usd_cents} cents`);
    return `coverage ${(report.coverage_bps / 100).toFixed(2)}% at the bundle's stated price`;
  });

  return summarize(c);
}

function summarize(c) {
  const failed = c.list.filter((x) => x.status === 'fail').length;
  const skipped = c.list.filter((x) => x.status === 'skip').length;
  return { ok: failed === 0, complete: failed === 0 && skipped === 0, failed, skipped, checks: c.list };
}
