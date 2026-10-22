// The challenge string every asset signature signs. It binds each signature
// to one chain, one block and one liabilities commitment, so a signature
// cannot be replayed into a different snapshot.
const HEADER = 'treasury-proof-of-reserves/v1';
const FIELDS = ['entity', 'network', 'height', 'block_hash', 'liabilities_root', 'nonce'];

export function buildChallenge({ entity, network, height, block_hash, liabilities_root, nonce }) {
  const values = { entity, network, height, block_hash, liabilities_root, nonce };
  for (const f of FIELDS) {
    const v = String(values[f]);
    if (v.includes('\n') || v.length === 0) throw new Error(`challenge field ${f} is empty or contains a newline`);
  }
  if (!/^[0-9a-f]{64}$/.test(block_hash)) throw new Error('block_hash must be 64 lowercase hex chars');
  return [HEADER, ...FIELDS.map((f) => `${f}: ${values[f]}`)].join('\n');
}

export function parseChallenge(text) {
  const lines = text.split('\n');
  if (lines[0] !== HEADER || lines.length !== FIELDS.length + 1) throw new Error('challenge has the wrong format');
  const out = {};
  FIELDS.forEach((f, i) => {
    const prefix = `${f}: `;
    if (!lines[i + 1].startsWith(prefix)) throw new Error(`challenge line ${i + 2} should start with "${prefix}"`);
    out[f] = lines[i + 1].slice(prefix.length);
  });
  out.height = Number(out.height);
  if (!Number.isSafeInteger(out.height)) throw new Error('challenge height is not an integer');
  return out;
}
