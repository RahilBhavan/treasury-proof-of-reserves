#!/usr/bin/env node
// CLI: `demo` builds a bundle on a local regtest node; `verify` checks one.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rpcClient, regtestChain } from './chain/regtest.js';
import { generateKey, buildBundle, randomHex } from './prove.js';
import { verifyBundle, DEFAULT_MAX_AGE_BLOCKS } from './bundle.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_PRICE = {
  usd_cents_per_btc: 10000000,
  source: 'fixed demo constant ($100,000.00/BTC); not a market quote',
  as_of: 'demo',
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function connect(args) {
  const url = args.rpc || process.env.TPOR_RPC_URL || `http://127.0.0.1:${process.env.TPOR_RPC_PORT || 18743}`;
  const datadir = resolve(args.datadir || process.env.TPOR_DATADIR || `${ROOT}/.regtest/data`);
  return rpcClient({ url, datadir });
}

async function demo(args) {
  const rpc = connect(args);
  const wallets = await rpc('listwallets');
  if (!wallets.includes('funder')) {
    try { await rpc('loadwallet', ['funder']); } catch { await rpc('createwallet', ['funder']); }
  }
  const mineTo = await rpc('getnewaddress', [], 'funder');
  if ((await rpc('getbalance', [], 'funder')) < 30) await rpc('generatetoaddress', [101, mineTo]);

  const keys = [generateKey('p2wpkh'), generateKey('p2wpkh'), generateKey('p2tr')];
  const amounts = [12.5, 7.25, 3.0];
  for (let i = 0; i < keys.length; i++) await rpc('sendtoaddress', [keys[i].address, amounts[i]], 'funder');
  await rpc('generatetoaddress', [6, mineTo]);

  const height = await rpc('getblockcount');
  const block_hash = await rpc('getblockhash', [height]);
  const chain = regtestChain(rpc);
  const balances = await chain.balancesAtHeight(keys.map((k) => k.address), height);

  const spec = JSON.parse(readFileSync(`${ROOT}/examples/liabilities.json`, 'utf8'));
  const liabilities = spec.liabilities.map((l) => ({ ...l, salt: randomHex(32) }));
  const bundle = buildBundle({
    entity: spec.entity, network: 'regtest', height, block_hash, keys, balances,
    liabilities, disclose: 'all', price: DEMO_PRICE,
  });

  // Move the tip past the snapshot so verification has to use the historical height.
  await rpc('generatetoaddress', [2, mineTo]);

  const out = resolve(args.out || 'bundle.json');
  writeFileSync(out, JSON.stringify(bundle, null, 2) + '\n');
  mkdirSync(`${ROOT}/.regtest`, { recursive: true });
  writeFileSync(`${ROOT}/.regtest/keys.json`, JSON.stringify(keys, null, 2) + '\n');
  console.log(`snapshot height ${height} (${block_hash})`);
  console.log(`wrote ${out}; regtest test keys in .regtest/keys.json (git-ignored)`);
  console.log(`assets ${bundle.report.assets_sats} sats, liabilities ${bundle.report.liabilities_usd_cents} cents, solvent=${bundle.report.solvent}`);
}

async function verify(args) {
  const file = args._[1];
  if (!file) throw new Error('usage: verify <bundle.json> [--offline] [--max-age N] [--json]');
  const bundle = JSON.parse(readFileSync(file, 'utf8'));
  const chain = args.offline ? null : regtestChain(connect(args));
  const maxAgeBlocks = args['max-age'] ? Number(args['max-age']) : DEFAULT_MAX_AGE_BLOCKS;
  const result = await verifyBundle(bundle, { chain, maxAgeBlocks });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const c of result.checks) console.log(`${c.status.toUpperCase().padEnd(4)}  ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
    const verdict = !result.ok ? 'INVALID' : result.complete ? 'VALID' : 'VALID EXCEPT SKIPPED CHECKS';
    console.log(`\n${verdict}: ${result.failed} failed, ${result.skipped} skipped`);
  }
  process.exitCode = result.ok ? 0 : 1;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const run = { demo, verify }[cmd];
if (!run) { console.error('usage: cli.js demo [--out file] | verify <bundle.json> [--offline] [--max-age N] [--json]'); process.exit(2); }
run(args).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
