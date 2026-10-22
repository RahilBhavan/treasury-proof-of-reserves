# Verification contract

This document specifies the existing v1 demo, tightened during publication review.
It is a fictional regtest exercise, not a company reserve attestation.

- `tpor-bundle/v1` carries entity, network, snapshot, challenge, assets,
  liabilities, stated price, content commitments, report, and digest.
- Asset signatures cover the exact challenge text: entity, network, height,
  block hash, liability root hash, and nonce. They do not sign the price or
  claimed balances. Content hashes detect changes only when compared with a
  separately trusted digest; anyone can recompute them.
- At least one disclosed liability inclusion witness is mandatory. It
  recomputes both hash and sum and binds the reported total to the signed
  root. Each additional disclosure is checked. This also applies to a
  single-leaf tree. Hidden liabilities can still be omitted by the prover.
- `leaf_count` and `leaf_index` are descriptive metadata, not independently
  authenticated counts or positions. Proof direction determines inclusion.
- Supported signatures are canonical base64 simple witness encodings,
  optionally prefixed `smp`, for P2WPKH with SIGHASH_ALL and single-key P2TR.
  Other P2WPKH sighash modes, legacy, nested SegWit, P2WSH, full and
  proof-of-funds variants are outside this adapter's supported subset.
- Amounts and totals use non-negative safe integers in sats or USD cents;
  price is positive USD cents per BTC. Valuation floors fractional cents.
  Unsafe valuations and coverage ratios are rejected rather than rounded.
- Output scripts, rather than address spelling, determine asset duplicates.
- The regtest chain adapter scans blocks 0..H, removing spent outpoints.
  A proof is a historical snapshot: coins spent after H still count at H.
  It trusts the selected Core node and assumes a stable chain while scanning.
  A chain tip must be a non-negative safe integer; malformed tips fail the
  chain query rather than establishing freshness.
- With no chain, exactly three checks are skipped for a structurally valid
  bundle: block hash, freshness, and balances. `ok` means no failed checks;
  `complete` additionally requires no skips. Neither is a legal ownership,
  completeness-of-liabilities, price, or security certification.
- CLI verification failures exit 1. Invalid JSON is an input error.
  Browser verification is local and never upgrades skipped chain checks.

No ledger or sibling repository is required. `examples/bundle.json` is a
self-contained public fixture; `src/bundle.js` exports the verifier contract.
