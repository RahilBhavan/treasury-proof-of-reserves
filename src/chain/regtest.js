// Read-only chain source backed by a local Bitcoin Core regtest node.
// Balances at a height come from scanning blocks 0..H with getblock verbosity 3
// (which includes each input's prevout), so the answer does not depend on the
// current tip or on a wallet. Fine for regtest; a mainnet verifier would use an
// indexer instead.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function rpcClient({ url, datadir }) {
  const cookie = readFileSync(join(datadir, 'regtest', '.cookie'), 'utf8').trim();
  const auth = 'Basic ' + Buffer.from(cookie).toString('base64');
  let id = 0;
  return async function rpc(method, params = [], wallet = null) {
    const res = await fetch(wallet ? `${url}/wallet/${wallet}` : url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify({ jsonrpc: '1.0', id: ++id, method, params }),
    });
    const body = await res.json();
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result;
  };
}

const toSats = (btc) => Math.round(btc * 1e8);

export function regtestChain(rpc) {
  return {
    async getTipHeight() { return rpc('getblockcount'); },
    async getBlockHash(h) { return rpc('getblockhash', [h]); },
    async balancesAtHeight(addresses, height) {
      const watch = new Set(addresses);
      const utxos = new Map(); // "txid:vout" -> { address, sats }
      for (let h = 0; h <= height; h++) {
        const block = await rpc('getblock', [await rpc('getblockhash', [h]), 3]);
        for (const tx of block.tx) {
          for (const vin of tx.vin) {
            if (vin.coinbase) continue;
            utxos.delete(`${vin.txid}:${vin.vout}`);
          }
          for (const out of tx.vout) {
            const a = out.scriptPubKey.address;
            if (a && watch.has(a)) utxos.set(`${tx.txid}:${out.n}`, { address: a, sats: toSats(out.value) });
          }
        }
      }
      const totals = new Map();
      for (const { address, sats } of utxos.values()) totals.set(address, (totals.get(address) ?? 0) + sats);
      return totals;
    },
  };
}
