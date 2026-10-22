// Prover side (Node): generate test keys, sign the challenge, assemble a bundle.
import { randomBytes } from 'node:crypto';
import * as ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';
import { initEccLib, networks, payments } from 'bitcoinjs-lib';
import { signSimple } from './bip322.js';
import { bytesToHex } from './canonical.js';
import { buildChallenge } from './challenge.js';
import { buildTree } from './merkleSum.js';
import { BUNDLE_FORMAT, computeCommitments, computeReport, bundleDigest } from './bundle.js';

initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const NETS = { regtest: networks.regtest, signet: networks.testnet };

// Test keys only. script_type is 'p2wpkh' or 'p2tr'.
export function generateKey(scriptType, network = 'regtest') {
  const net = NETS[network];
  const kp = ECPair.makeRandom({ network: net });
  const pubkey = kp.publicKey;
  const address = scriptType === 'p2tr'
    ? payments.p2tr({ internalPubkey: pubkey.slice(1, 33), network: net }).address
    : payments.p2wpkh({ pubkey, network: net }).address;
  return { script_type: scriptType, address, wif: kp.toWIF() };
}

export function randomHex(n = 32) {
  return bytesToHex(randomBytes(n));
}

export function signChallenge(key, challenge) {
  return signSimple(key.wif, key.address, challenge);
}

// liabilities: leaves (with salts). disclose: which leaf ids get inclusion proofs
// in the public bundle (in practice each creditor would receive only their own).
export function buildBundle({ entity, network, height, block_hash, keys, balances, liabilities, disclose, price, nonce = randomHex(16) }) {
  const tree = buildTree(liabilities);
  const challenge = buildChallenge({ entity, network, height, block_hash, liabilities_root: tree.root.hash, nonce });
  const proofs = keys.map((k) => ({
    address: k.address,
    script_type: k.script_type,
    format: 'bip322-simple (smp)',
    signature: signChallenge(k, challenge),
    claimed_sats: balances.get(k.address) ?? 0,
  }));
  const assets = { proofs, total_claimed_sats: proofs.reduce((s, p) => s + p.claimed_sats, 0) };
  const disclosed = liabilities
    .map((leaf, i) => ({ leaf, proof: tree.proofs[i] }))
    .filter(({ leaf }) => disclose === 'all' || disclose.includes(leaf.id));

  const bundle = {
    format: BUNDLE_FORMAT,
    entity,
    network,
    snapshot: { height, block_hash },
    challenge,
    assets,
    liabilities: { root: tree.root, disclosed_leaves: disclosed },
    price,
  };
  bundle.commitments = computeCommitments(bundle);
  bundle.report = computeReport(assets.total_claimed_sats, tree.root.sum, price.usd_cents_per_btc);
  bundle.bundle_digest = bundleDigest(bundle);
  return bundle;
}
