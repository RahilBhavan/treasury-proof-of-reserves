// Checks the signature layer against the official BIP-322 test vectors,
// copied from https://github.com/bitcoin/bips/blob/130b8e0fa7f30fa45532f080b87b8db27a79e46e/bip-0322/basic-test-vectors.json
// (fetched 2026-10-21). bip322-js does not support P2WSH, so that vector is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signSimple, verifySimple } from '../src/bip322.js';
import { generateKey } from '../src/prove.js';

const vectors = JSON.parse(readFileSync(new URL('./vectors/bip322-basic-test-vectors.json', import.meta.url), 'utf8'));
const supported = (v) => v.type === 'p2wpkh' || v.type === 'p2tr';

test('official "simple" vectors verify (P2WPKH and P2TR)', () => {
  const vs = vectors.simple.filter(supported);
  assert.ok(vs.length >= 3);
  for (const v of vs) for (const sig of v.bip322_signatures) {
    assert.equal(verifySimple(v.address, v.message, sig), true, `${v.type} ${JSON.stringify(v.message)}`);
  }
});

test('official error vectors on supported address types are rejected', () => {
  const vs = vectors.error.filter((v) => !/p2wsh/.test(v.description));
  assert.ok(vs.length >= 5);
  for (const v of vs) assert.equal(verifySimple(v.address, v.message, v.signature), false, v.description);
});

test('our signer emits the "smp" prefix and round-trips on regtest P2WPKH and P2TR', () => {
  for (const t of ['p2wpkh', 'p2tr']) {
    const k = generateKey(t);
    const sig = signSimple(k.wif, k.address, 'challenge');
    assert.ok(sig.startsWith('smp'));
    assert.equal(verifySimple(k.address, 'challenge', sig), true);
    assert.equal(verifySimple(k.address, 'challenge2', sig), false);
  }
});

test('full and proof-of-funds variants are refused rather than misread', () => {
  const k = generateKey('p2wpkh');
  const body = signSimple(k.wif, k.address, 'm').slice(3);
  assert.equal(verifySimple(k.address, 'm', 'ful' + body), false);
  assert.equal(verifySimple(k.address, 'm', 'pof' + body), false);
  assert.equal(verifySimple(k.address, 'm', body), true); // unprefixed = pre-final simple encoding
});

test('simple verification rejects altered sighash flags, trailing bytes and malformed base64', () => {
  const k = generateKey('p2wpkh');
  const sig = signSimple(k.wif, k.address, 'm');
  const bytes = Buffer.from(sig.slice(3), 'base64');
  const altered = Buffer.from(bytes);
  altered[1 + altered[1]] = 2; // sighash byte of first witness element
  for (const bad of ['smp' + altered.toString('base64'), 'smp' + Buffer.concat([bytes, Buffer.from([0])]).toString('base64'), sig + '!']) {
    assert.equal(verifySimple(k.address, 'm', bad), false);
  }
});
