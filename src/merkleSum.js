// Merkle-sum tree over a treasury company's liabilities.
//
// Each internal node commits to BOTH child hashes and BOTH child sums
// separately. The original 2013 construction hashed only the parent total,
// which lets a dishonest prover shift value between siblings; committing to
// each child sum is the improvement proposed by Hu, Zhang and Guo (2018). See
// docs/research.md.
import { canonicalJson, sha256Bytes, bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from './canonical.js';

const LEAF_TAG = utf8ToBytes('tpor/leaf/v1');
const NODE_TAG = utf8ToBytes('tpor/node/v1');
const PAD_TAG = utf8ToBytes('tpor/pad/v1');

export const LIABILITY_KINDS = ['convertible_note', 'preferred_stock', 'term_loan', 'other_debt'];

const LEAF_FIELDS = ['id', 'kind', 'label', 'notional_usd_cents', 'salt'];

export function validateLeaf(leaf) {
  const keys = Object.keys(leaf).sort();
  if (keys.join(',') !== [...LEAF_FIELDS].sort().join(',')) {
    throw new Error(`liability leaf must have exactly the fields ${LEAF_FIELDS.join(', ')}`);
  }
  if (typeof leaf.id !== 'string' || leaf.id.length === 0) throw new Error('leaf id must be a non-empty string');
  if (!LIABILITY_KINDS.includes(leaf.kind)) throw new Error(`leaf ${leaf.id}: unknown kind ${leaf.kind}`);
  if (typeof leaf.label !== 'string') throw new Error(`leaf ${leaf.id}: label must be a string`);
  if (!Number.isSafeInteger(leaf.notional_usd_cents) || leaf.notional_usd_cents < 0) {
    throw new Error(`leaf ${leaf.id}: notional_usd_cents must be a non-negative safe integer`);
  }
  if (!/^[0-9a-f]{64}$/.test(leaf.salt)) throw new Error(`leaf ${leaf.id}: salt must be 32 bytes of lowercase hex`);
}

function u64be(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`sum out of range: ${n}`);
  const out = new Uint8Array(8);
  let v = BigInt(n);
  for (let i = 7; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}

export function leafHash(leaf) {
  validateLeaf(leaf);
  return sha256Bytes(concatBytes(LEAF_TAG, utf8ToBytes(canonicalJson(leaf))));
}

function padNode(index) {
  return { hash: sha256Bytes(concatBytes(PAD_TAG, u64be(index))), sum: 0 };
}

function parent(left, right) {
  const sum = left.sum + right.sum;
  if (!Number.isSafeInteger(sum)) throw new Error('sum overflow');
  return {
    hash: sha256Bytes(concatBytes(NODE_TAG, left.hash, u64be(left.sum), right.hash, u64be(right.sum))),
    sum,
  };
}

// Returns { root: {hash, sum, leaf_count}, proofs: [{leaf_index, path}] }.
export function buildTree(leaves) {
  if (leaves.length === 0) throw new Error('need at least one liability');
  const ids = new Set();
  for (const l of leaves) {
    if (ids.has(l.id)) throw new Error(`duplicate liability id ${l.id}`);
    ids.add(l.id);
  }
  let size = 1;
  while (size < leaves.length) size *= 2;
  let level = leaves.map((l) => ({ hash: leafHash(l), sum: l.notional_usd_cents }));
  for (let i = leaves.length; i < size; i++) level.push(padNode(i));

  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(parent(level[i], level[i + 1]));
    levels.push(next);
    level = next;
  }
  const top = level[0];
  const proofs = leaves.map((_, idx) => {
    const path = [];
    let i = idx;
    for (let d = 0; d < levels.length - 1; d++) {
      const sib = levels[d][i ^ 1];
      path.push({ side: i % 2 === 0 ? 'right' : 'left', hash: bytesToHex(sib.hash), sum: sib.sum });
      i >>= 1;
    }
    return { leaf_index: idx, path };
  });
  return { root: { hash: bytesToHex(top.hash), sum: top.sum, leaf_count: leaves.length }, proofs };
}

// Verifies one creditor's leaf against the published root. Throws on failure.
export function verifyInclusion(leaf, proof, root) {
  let node = { hash: leafHash(leaf), sum: leaf.notional_usd_cents };
  for (const step of proof.path) {
    if (!Number.isSafeInteger(step.sum) || step.sum < 0) throw new Error('sibling sum is negative or not an integer');
    if (!/^[0-9a-f]{64}$/.test(step.hash)) throw new Error('sibling hash is malformed');
    const sib = { hash: hexToBytes(step.hash), sum: step.sum };
    if (step.side === 'right') node = parent(node, sib);
    else if (step.side === 'left') node = parent(sib, node);
    else throw new Error(`bad side ${step.side}`);
  }
  if (bytesToHex(node.hash) !== root.hash) throw new Error(`leaf ${leaf.id}: recomputed root hash does not match`);
  if (node.sum !== root.sum) throw new Error(`leaf ${leaf.id}: recomputed root sum ${node.sum} != published ${root.sum}`);
  return true;
}
