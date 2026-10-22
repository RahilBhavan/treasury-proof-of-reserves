// Validate untrusted JSON once, before verification traverses it or does arithmetic.
export function validateBundle(b, maxAgeBlocks) {
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const integer = (v) => Number.isSafeInteger(v) && v >= 0;
  const hex = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
  const require = (ok, message) => { if (!ok) throw new Error(message); };
  require(object(b), 'bundle must be an object');
  require(integer(maxAgeBlocks), 'maxAgeBlocks must be a non-negative safe integer');
  require(typeof b.entity === 'string' && b.entity.length > 0, 'entity required');
  require(['regtest', 'signet', 'testnet', 'mainnet'].includes(b.network), 'unknown network');
  require(typeof b.challenge === 'string', 'challenge must be text');
  require(object(b.snapshot) && integer(b.snapshot.height) && hex(b.snapshot.block_hash), 'snapshot malformed');
  require(object(b.assets) && Array.isArray(b.assets.proofs) && b.assets.proofs.length > 0, 'asset proofs required');
  require(integer(b.assets.total_claimed_sats), 'asset total must be a non-negative safe integer');
  let total = 0;
  for (const p of b.assets.proofs) {
    require(object(p) && typeof p.address === 'string' && typeof p.signature === 'string' && integer(p.claimed_sats), 'asset proof malformed');
    total += p.claimed_sats;
    require(integer(total), 'asset sum overflow');
  }
  require(object(b.liabilities) && object(b.liabilities.root) && Array.isArray(b.liabilities.disclosed_leaves), 'liabilities malformed');
  const root = b.liabilities.root;
  require(hex(root.hash) && integer(root.sum) && integer(root.leaf_count) && root.leaf_count > 0, 'liability root malformed');
  for (const d of b.liabilities.disclosed_leaves) {
    require(object(d) && object(d.leaf) && object(d.proof) && Array.isArray(d.proof.path), 'liability witness malformed');
  }
  require(object(b.price) && integer(b.price.usd_cents_per_btc) && b.price.usd_cents_per_btc > 0, 'price must be a positive safe integer');
  const cents = BigInt(total) * BigInt(b.price.usd_cents_per_btc) / 100000000n;
  require(cents <= BigInt(Number.MAX_SAFE_INTEGER), 'asset valuation overflow');
  require(root.sum === 0 || cents * 10000n / BigInt(root.sum) <= BigInt(Number.MAX_SAFE_INTEGER), 'coverage overflow');
  require(object(b.commitments) && object(b.report) && hex(b.bundle_digest), 'commitments or report malformed');
}
