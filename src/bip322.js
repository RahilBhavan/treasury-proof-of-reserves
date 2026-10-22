// BIP-322 "simple" signatures via bip322-js, plus the variant prefix that the
// completed BIP (v1.0.0, 2026-04-15) requires. bip322-js 4.0.0 emits and
// accepts the older unprefixed encoding, so this wrapper adds "smp" when
// signing and strips it before verifying. Unprefixed signatures are accepted
// as "simple", which the BIP allows for backward compatibility. "ful" and
// "pof" signatures are not supported here and are rejected.
import { Signer, Verifier } from 'bip322-js';

export const SIMPLE_PREFIX = 'smp';

export function signSimple(wif, address, message) {
  return SIMPLE_PREFIX + Signer.sign(wif, address, message);
}

export function verifySimple(address, message, signature) {
  if (typeof signature !== 'string' || signature.length === 0) return false;
  let body = signature;
  if (signature.startsWith(SIMPLE_PREFIX)) body = signature.slice(SIMPLE_PREFIX.length);
  else if (/^(ful|pof)/.test(signature)) return false;
  try {
    // The dependency also accepts legacy signatures and ignores the P2WPKH
    // sighash byte. Constrain this adapter to its supported simple subset.
    if (!/^(bc1|tb1|bcrt1)/.test(address)) return false;
    const bytes = Buffer.from(body, 'base64');
    if (bytes.toString('base64') !== body) return false;
    const count = bytes[0];
    if (count !== 1 && count !== 2) return false;
    let offset = 1;
    const witness = [];
    for (let i = 0; i < count; i++) {
      const length = bytes[offset++];
      if (length === undefined || length >= 253 || offset + length > bytes.length) return false;
      witness.push(bytes.subarray(offset, offset + length));
      offset += length;
    }
    if (offset !== bytes.length) return false;
    if (count === 2) {
      if (!/^(bc1q|tb1q|bcrt1q)/.test(address) || witness[1].length !== 33 || witness[0].at(-1) !== 1) return false;
    } else {
      if (!/^(bc1p|tb1p|bcrt1p)/.test(address)) return false;
      const sig = witness[0];
      if (sig.length !== 64 && !(sig.length === 65 && [1, 2, 3, 129, 130, 131].includes(sig[64]))) return false;
    }
    return Verifier.verifySignature(address, message, body) === true;
  } catch {
    return false;
  }
}
