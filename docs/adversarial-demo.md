# Reproduce the adversarial demonstration in five minutes

Use Node 26.8.1 and a clone of this repository. No Core node, credentials,
private keys, network calls or paid service is needed after dependency install.

```sh
npm ci
npm run demo:adversarial
node scripts/adversarial-demo.mjs --json > adversarial-results.json
npm test
```

The demo exits **0 only when all nine expectations match**, including expected
rejections; an unexpected verdict or failure/skip name exits 1. The JSON command
emits only JSON. Results contain the full check details, expected failure/skip
names, `matches`, `ok` and `complete`. Human output distinguishes verifier check
PASS/FAIL/SKIP from the final demo assertion result. Nothing is written unless
you redirect stdout. Remove your results file afterward; no generated result is
needed in Git. Repeat runs produce byte-identical JSON and do not mutate the
committed bundle, a node, or local private state.

Expected cases:

- `fresh-at-limit`: simulated tip H+144, every check PASS, `complete=true`.
- `offline-baseline`: `ok=true`, `complete=false`, exactly three SKIPs.
- `altered-balance`: add 1 BTC to the first claim and recompute commitments,
  arithmetic and digest. Those checks PASS; its chain balance check FAILs.
- `altered-balance-offline`: identical inflation passes offline checks, with
  exactly three SKIPs. Public checksums cannot authenticate claimed balances.
- `missing-witnesses`: remove every witness, reduce root sum to zero, reseal.
  The liabilities root check FAILs despite intact asset signatures.
- `invalid-signature`: substitute address B's signature for A, reseal. A's
  signature FAILs; the final coverage check also FAILs because signatures failed.
- `stale-evidence`: unchanged bundle, simulated tip H+145. Freshness FAILs.
- `stale-evidence-offline`: without a tip, freshness stays SKIP.
- `invalid-chain-tip`: simulated adapter returns NaN. Chain query FAILs;
  freshness cannot PASS and the verdict cannot be complete.

Every offline case skips **block hash at height**, **snapshot freshness**, and
**balances at height**. A passing arithmetic line in a rejected bundle is only
that individual computation's result, not a reserve attestation.

## Evidence and limits

Implementation and verification date: 2026-10-22. Input is the unchanged
`examples/bundle.json` from the prior local regtest run: fictional entity,
height 113, 22.75 BTC, five disclosed fictional instruments totalling
$2,000,000, and a fixed demo $100,000/BTC price. No market price or new
financial disclosure is introduced. The three simulated chain observations
(hash, tip, balances) are explicitly test data; the balances and hash are copied
from the original fixture before mutation, so attacks cannot rewrite the
simulation's observations. This is a verifier demonstration, **not independent
chain confirmation**. The offline variants deliberately show what it misses.
Staleness is measured in blocks under this project's 144-block policy, not
wall-clock or price freshness. The two offline freshness scenarios necessarily
use the same unchanged bundle: age is unavailable without a chain source.

Primary protocol source: [BIP-322 at pinned commit
130b8e0fa7f30fa45532f080b87b8db27a79e46e](https://github.com/bitcoin/bips/blob/130b8e0fa7f30fa45532f080b87b8db27a79e46e/bip-0322.mediawiki),
consulted 2026-10-22. It defines simple witness signatures and explains the
limits of message signatures as evidence of funds. This project still supports
only the subset recorded in [spec.md](spec.md); upstream text/vectors and
package versions were not changed. No upstream text is copied into this demo.

No scenario establishes beneficial ownership, unborrowed or unencumbered
coins, complete liabilities, a correct price, ongoing solvency, or a real
company's reserves. See [threat-model.md](threat-model.md). The example's real
regtest node checks remain separately reproducible via the README; these
simulations do not replace that integration test. There is no browser UI change.

## Observed verification

Baseline: 42 tests, 41 PASS, one Core integration SKIP. The new regression
initially failed because a NaN tip returned `ok=true`; validation now rejects
non-safe, negative, fractional and nonnumeric tips at the chain-response
boundary before freshness arithmetic. No bundle schema or signing changes.

Final local checks: 46 tests, 45 PASS, one Core integration SKIP (node not
running). Syntax check, web build, browser-artifact VM check and offline CLI
verification pass. Nine demo expectations match; repeated JSON is identical. One measured local
JSON run took 330 ms and emitted 30,386 bytes on Node 26.8.1; this is a
single-run observation, not a performance guarantee.
The VM runs the bundled browser verifier without Node globals or network;
it is not real browser rendering or cross-browser certification. Page, styles,
fonts and screenshot are unchanged. CI now also runs the demo explicitly.
