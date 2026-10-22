// Integration test against a real Bitcoin Core regtest node started with
// `npm run regtest:start`. Skips (and says so) when no node is reachable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rpcClient, regtestChain } from '../src/chain/regtest.js';
import { generateKey, buildBundle } from '../src/prove.js';
import { verifyBundle } from '../src/bundle.js';
import { liabilities, PRICE, failed } from './helpers.js';

const datadir = resolve(dirname(fileURLToPath(import.meta.url)), '../.regtest/data');
const url = `http://127.0.0.1:${process.env.TPOR_RPC_PORT || 18743}`;

async function connect() {
  if (!existsSync(`${datadir}/regtest/.cookie`)) return null;
  try { const rpc = rpcClient({ url, datadir }); await rpc('getblockcount'); return rpc; } catch { return null; }
}

const rpc = await connect();

test('regtest: balances at a past height, borrowed coins after the snapshot, and staleness', { skip: rpc ? false : 'no regtest node; run npm run regtest:start' }, async () => {
  const wallets = await rpc('listwallets');
  if (!wallets.includes('funder')) {
    try { await rpc('loadwallet', ['funder']); } catch { await rpc('createwallet', ['funder']); }
  }
  const mineTo = await rpc('getnewaddress', [], 'funder');
  if ((await rpc('getbalance', [], 'funder')) < 25) await rpc('generatetoaddress', [101, mineTo]);

  const keys = [generateKey('p2wpkh'), generateKey('p2tr')];
  const fundingTxid = await rpc('sendtoaddress', [keys[0].address, 10.0], 'funder');
  await rpc('sendtoaddress', [keys[1].address, 5.0], 'funder');
  await rpc('generatetoaddress', [1, mineTo]);
  const height = await rpc('getblockcount');
  const block_hash = await rpc('getblockhash', [height]);
  // Spend coins held at H after H: historical reserves still count them.
  const block = await rpc('getblock', [block_hash, 2]);
  const output = block.tx.find((tx) => tx.txid === fundingTxid).vout.find((v) => v.scriptPubKey.address === keys[0].address);
  const raw = await rpc('createrawtransaction', [[{ txid: fundingTxid, vout: output.n }], { [mineTo]: 9.9999 }]);
  const signed = await rpc('signrawtransactionwithkey', [raw, [keys[0].wif]]);
  assert.equal(signed.complete, true);
  await rpc('sendrawtransaction', [signed.hex]);
  const chain = regtestChain(rpc);

  // Coins that arrive one block after the snapshot ("borrowed" for the report).
  await rpc('sendtoaddress', [keys[1].address, 4.0], 'funder');
  await rpc('generatetoaddress', [1, mineTo]);

  const atH = await chain.balancesAtHeight(keys.map((k) => k.address), height);
  assert.equal(atH.get(keys[0].address), 1000000000);
  assert.equal(atH.get(keys[1].address), 500000000);
  const atTip = await chain.balancesAtHeight(keys.map((k) => k.address), height + 1);
  assert.equal(atTip.get(keys[0].address) ?? 0, 0);
  assert.equal(atTip.get(keys[1].address), 900000000);

  const honest = buildBundle({ entity: 'Regtest Co', network: 'regtest', height, block_hash, keys, balances: atH, liabilities: liabilities(), disclose: 'all', price: PRICE });
  const ok = await verifyBundle(honest, { chain });
  assert.deepEqual(failed(ok), []);
  assert.equal(ok.complete, true);

  const inflated = new Map(atH);
  inflated.set(keys[1].address, 900000000);
  const dishonest = buildBundle({ entity: 'Regtest Co', network: 'regtest', height, block_hash, keys, balances: inflated, liabilities: liabilities(), disclose: 'all', price: PRICE });
  const bad = await verifyBundle(dishonest, { chain });
  assert.deepEqual(failed(bad), [`balance ${keys[1].address}`]);

  const stale = await verifyBundle(honest, { chain, maxAgeBlocks: 0 });
  assert.deepEqual(failed(stale), ['snapshot freshness']);
});
