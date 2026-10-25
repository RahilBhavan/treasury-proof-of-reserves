# Review and verification evidence

Purpose: record publication checks and their limits. Financial source context
is frozen at 2026-10-21; verification ran on 2026-10-22 UTC (2026-10-21 Detroit).

## Baseline and review

Starting commit: `f0c8bfc`; clean working tree. Baseline: 35 tests,
34 passed, one skipped without Core. No original `docs/spec.md`, methodology
file, CI workflow, or separate verification document existed; the methodology
was in the README, research notes and threat model.

The code-reviewer sweep covered correctness, security, error handling,
accessibility, performance, dead code, and repository conventions. Confirmed
issues below were reproduced before repair. No measured performance issue,
proven dead code, or additional accessibility/convention defect survived review.
This is a source review, not a security audit or certification.

| Trigger | Previous result | Repair and regression evidence |
|---|---|---|
| Remove all disclosed leaves, set root sum to zero, recompute public hashes | Accepted even against the test chain with unchanged asset signatures | Require an inclusion witness; `tests/binding.test.js` |
| Null/missing structure; negative claims and negative price | Throw, or accept a positive valuation from two negatives | Validate JSON at verifier boundary, numeric ranges and overflow; `tests/binding.test.js` |
| Change P2WPKH witness sighash byte from 1 to 2 without resigning | Accepted by dependency | Restrict supported witness encodings and SIGHASH_ALL; `tests/bip322.test.js` |
| Append witness bytes or malformed base64 | Dependency input decoding was permissive | Exact canonical base64 and witness consumption; same regression suite |

The independent T3 read-only review task `tpor-review-1` failed due to an
automatic safety rejection and returned no review. The owner performed the
review and executable verification. No independent-review claim is made.

## Commands and observed results

- `npm ci`, `npm run check`, `npm test`, `npm run build:web`,
  `node scripts/check-browser.mjs` and offline CLI verification work without
  Core. 46 tests: 45 pass, one optional integration test skips.
- With Bitcoin Core 31.1 running, 46/46 tests pass, none skipped. The integration
  test sends coins after H, spends coins held at H after H, compares H and tip
  balances, rejects inflated historical claims, and rejects stale snapshots.
- Two consecutive `demo` runs followed by CLI verification each produced
  22.75 BTC, $2,000,000 liabilities and 113.75% coverage at the fixed
  $100,000/BTC demo price; all checks passed against Core. Bundles are randomized
  and chain heights vary; repeat runs spend regtest funds and are not idempotent.
- Browser example load in the T3 Chromium preview: 17 pass, zero fail,
  three skip. The generated artifact also executes in a Node VM without Node
  globals/network; negative inputs fail in that artifact. This is not a
  Firefox/Safari/mobile certification.
- BIP-322 vectors match the upstream frozen file byte-for-byte. SHA-256:
  `a9184da5687b9cb7a1863807f4a8f4d743ec07d4f683f707cb85ce72f5b33f47`.
  Source and CC0-1.0 attribution: [BIP-322 at frozen commit](https://github.com/bitcoin/bips/blob/130b8e0fa7f30fa45532f080b87b8db27a79e46e/bip-0322.mediawiki).

- Re-run on 2026-10-24 with Core 31.1 (Linux x86_64 tarball, SHA-256 and
  signatures checked as below) on a fresh regtest datadir: `npm run regtest:start`,
  `npm run demo` (height 107, 22.75 BTC, solvent), `npm run verify` (0 failed,
  0 skipped) and `npm test` (46 tests, 46 pass, 0 skipped).

## Core provenance

Linux x86_64 archive fetched from
`https://bitcoincore.org/bin/bitcoin-core-31.1/bitcoin-31.1-x86_64-linux-gnu.tar.gz`.
SHA-256 matched `SHA256SUMS` from that release directory:
`b80d9c3e04da78fb6f0569685673418cf686fadba9042d926d13fb87ff503f9e`.
An isolated GPG keyring verified the manifest signature using fanquake's key
from the bitcoin-core/guix.sigs builder-keys repository. Primary fingerprint:
`E777299FC265DD04793070EB944D35F9AC3DB76A`;
signing subkey `CFB16E21C950F67FA95E558F2EEB9F5CC09526C1`.
This verifies consistency with the fetched release/key material; no independent
out-of-band identity check or reproducible binary build was performed.
Follow [Core's verification instructions](https://bitcoincore.org/en/download/)
when selecting your own release and trusted signer identities.

## Unresolved limits

See [spec.md](spec.md) and [threat-model.md](threat-model.md). Borrowed or
encumbered coins, omitted obligations, beneficial ownership, and an inflated
stated price remain undetectable. Historical snapshot coverage is not ongoing
solvency. No real company wallet, account, financial or identity data is used.
The chain scan is intentionally linear for regtest; no public-chain indexer,
reorg-atomic snapshot, retry policy, or browser node integration is implemented.
Restarting Core retains its ignored datadir; regenerating a bundle uses new
random keys and salts. No private state is needed for offline verification.
