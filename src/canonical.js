// Canonical JSON and hashing shared by the Node CLI and the browser verifier.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from '@noble/hashes/utils.js';

export { bytesToHex, hexToBytes, utf8ToBytes, concatBytes };

// Sorted keys, no whitespace. Rejects values whose JSON form is ambiguous.
export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`non-integer or unsafe number in committed data: ${value}`);
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  throw new Error(`cannot canonicalize ${typeof value}`);
}

export function sha256Hex(bytes) {
  return bytesToHex(sha256(bytes));
}

export function sha256Bytes(bytes) {
  return sha256(bytes);
}

export function commit(value) {
  return sha256Hex(utf8ToBytes(canonicalJson(value)));
}
