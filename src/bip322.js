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
    return Verifier.verifySignature(address, message, body) === true;
  } catch {
    return false;
  }
}
