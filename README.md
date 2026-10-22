# Treasury proof of reserves: a regtest demo of how a bitcoin-treasury company could prove assets cover its liabilities

[![CI](https://github.com/RahilBhavan/treasury-proof-of-reserves/actions/workflows/ci.yml/badge.svg)](https://github.com/RahilBhavan/treasury-proof-of-reserves/actions/workflows/ci.yml)

![Rahil Design browser verifier with the fictional example loaded; its verdict explicitly preserves three skipped on-chain checks.](docs/img/verifier-rahil-design.webp)

This repository builds and verifies a proof-of-reserves bundle for a fictional bitcoin-treasury company on a local Bitcoin Core regtest node. The asset side is BIP-322 signatures over a challenge that contains a block hash, checked against balances recomputed from the chain at that height. The liability side is a Merkle-sum tree over debt and preferred-stock instruments, with an inclusion proof per instrument. The output is one JSON bundle that a CLI or a static web page verifies, plus a written threat model of what the proof does and does not show.

## What it does

- **Asset proofs.** Signs a challenge (`entity`, `network`, `height`, `block_hash`, `liabilities_root`, `nonce`) with BIP-322 *simple* signatures for P2WPKH and P2TR test addresses. Signatures carry the `smp` prefix from the completed BIP.
- **Balances at a height.** Recomputes each address's unspent balance at height H by scanning blocks 0 to H on a regtest node, so the answer does not depend on the current tip.
- **Liability tree.** Builds a Merkle-sum tree over salted instrument leaves (`convertible_note`, `preferred_stock`, `term_loan`, `other_debt`). Each node commits to both child sums separately, which fixes the known flaw in the original construction.
- **Report.** Core report inputs are hash-committed, and the report states whether assets at a stated BTC/USD price are at least the liability total.
- **Verifiers.** A CLI runs all checks against a node. A static page (`web/index.html`) runs the signature, tree, commitment and arithmetic checks in the browser and marks the on-chain checks as skipped.

Example run (`examples/bundle.json`, regtest height 113): 3 addresses holding 22.75 BTC; 5 fictional instruments totalling $2,000,000.00; at a fixed demo price of $100,000.00 per BTC, assets are $2,275,000.00 and coverage is 113.75%. The price is a demo constant, not a market quote.

## How it works

1. `src/merkleSum.js` builds the liability tree and verifies inclusion proofs.
2. `src/challenge.js` builds and parses the challenge text that every signature signs.
3. `src/bip322.js` wraps `bip322-js` for signing and verifying, and handles the `smp` prefix.
4. `src/prove.js` generates test keys, signs and assembles the bundle.
5. `src/bundle.js` is the verifier. It runs in Node and, bundled by esbuild, in the browser.
6. `src/chain/regtest.js` is a read-only RPC chain source: block hash, tip and balances at a height.
7. `src/cli.js` provides `demo` (fund addresses on regtest, snapshot, sign, write the bundle) and `verify`.

## Run it

Prerequisites: Node.js (tested on 26.8.1; older versions not tried) and, for the chain checks, Bitcoin Core `bitcoind` (tested on 31.1, downloaded from bitcoincore.org, checksum matched, manifest signature checked; see [verification](docs/verification.md)).

```sh
npm ci
npm run check
npm test
```

Observed: 42 tests: 41 pass and one skips without Core; 42 pass with Core 31.1. The one regtest integration test runs only when a node from `npm run regtest:start` is reachable; otherwise it is reported as skipped.

End-to-end on regtest:

```sh
BITCOIN_BIN_DIR=/path/to/bitcoin-31.1/bin npm run regtest:start   # RPC on 127.0.0.1:18743, data in .regtest/
npm run demo                                                       # writes examples/bundle.json
npm run verify                                                     # all checks against the node
BITCOIN_BIN_DIR=/path/to/bitcoin-31.1/bin npm run regtest:stop
```

Offline check (no node; on-chain checks are skipped): `node src/cli.js verify examples/bundle.json --offline`.

Adversarial demonstration (no node): `npm run demo:adversarial`. Nine deterministic
cases cover resealed balance inflation, missing witnesses, invalid signatures,
stale evidence and malformed chain tips. Simulated-chain checks are explicitly
labelled; offline variants preserve exactly three SKIPs. See the
[five-minute example and limits](docs/adversarial-demo.md).

Browser verifier:

```sh
npm run build:web                      # writes web/vendor/por.bundle.js
node scripts/check-browser.mjs          # exercises the artifact without Node globals
python3 -m http.server 8000            # then open http://127.0.0.1:8000/web/
```

The page also works from `file://` with the file picker; only the "Load the example bundle" button needs HTTP.

## Repository layout

- `src/` - prover, verifier, Merkle-sum tree, challenge format and the regtest chain source.
- `tests/` - Node test runner suites and the official BIP-322 test vectors (`tests/vectors/`).
- `web/` - the static verifier page; `web/vendor/` is the build output and is not committed.
- `examples/` - fictional liabilities input and a bundle produced by a real regtest run.
- `scripts/` - start, stop and wipe the local regtest node.
- `docs/` - research notes, threat model and the screenshot.

## Documentation

- [Public design system](DESIGN.md): Rahil Design 3.3.0, shared tokens and visual review rules.

- [docs/spec.md](docs/spec.md) - bundle contract, signed fields and supported signature subset.
- [docs/verification.md](docs/verification.md) - reproduced defects, fixes, exact checks and Core provenance.
- [docs/publication.md](docs/publication.md) - publication receipt and remote verification.

- [docs/threat-model.md](docs/threat-model.md) - what a passing bundle proves, what it cannot (borrowed coins, omitted liabilities, price, seniority), and design notes for a zero-knowledge version.
- [docs/research.md](docs/research.md) - cited sources on Merkle-sum trees, BIP-322, PoR weaknesses and what is public about Strategy's custody.

## Sources

- BIP-322 text and test vectors: github.com/bitcoin/bips at commit `130b8e0`, fetched 2026-10-21. The CC0-1.0 vectors are copied unchanged into `tests/vectors/`; their SHA-256 is in [verification](docs/verification.md).
- Chain data: a local regtest chain created by `npm run demo`. No mainnet or signet data is used.
- Liabilities: fictional instruments in `examples/liabilities.json`, shaped like a treasury company's capital stack. They are not Strategy's actual liabilities.
- Background facts (custodians, holdings, Arkham attributions) are cited with dates in [docs/research.md](docs/research.md).

## Scope and limits

- Independent work. Not affiliated with, reviewed by or endorsed by Strategy or Coinbase.
- Demo only: test keys on a local regtest network. Private keys are written to `.regtest/keys.json`, which is git-ignored. Do not use this code with real funds.
- The research notes freeze source context at October 21, 2026. The cited Strategy disclosures supply no wallet list. Its FY2025 10-K names custodians; third-party address attributions such as Arkham's are attributions, not proof. Nothing here proves anything about Strategy.
- The chain source is regtest only. A public signet or mainnet source (an indexer) is not implemented.
- `bip322-js` 4.0.0 is used for P2WPKH (SIGHASH_ALL only) and single-key P2TR. P2WSH, *full* and *proof-of-funds* signatures are not supported. `bitcoinjs-lib` is pinned to 7.0.1 because signing fails with 7.0.4.
- The proof does not detect borrowed coins, omitted liabilities, encumbered coins or a wrong price. See [docs/threat-model.md](docs/threat-model.md).
- At least one liability witness is required to bind the sum to the signed root hash. Leaf count/index are descriptive metadata. Public content hashes are recomputable checksums, not issuer authentication; claimed balances and price are not signed.
- The zero-knowledge version is a design note only.

## License

[MIT](LICENSE). The license covers this project's code only. Fonts in `web/fonts/` keep their own licenses (see `web/fonts/SOURCES.md`).

Part of [Rahil Bhavan's projects](https://github.com/RahilBhavan).
