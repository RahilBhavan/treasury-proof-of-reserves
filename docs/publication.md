# Publication receipt

Status: public repository and reviewed implementation verified on 2026-10-22 UTC.
The final documentation receipt is a descendant of the implementation commit.

- Public repository: `https://github.com/RahilBhavan/treasury-proof-of-reserves`.
- Starting commit: `f0c8bfc`; original v1 history retained.
- Local verification: 42/42 with Core 31.1; 41 pass and one skip offline.
  Syntax checks, browser build and isolated browser-artifact checks pass.
- Core archive and official BIP vectors: hashes and provenance in
  [verification.md](verification.md).
- Publication audit: all 31 unique blobs reachable from all refs inspected for
  credential patterns, private artifact paths, contact material and blob size.
  Only key-pattern match: upstream CC0 BIP-322 public test vectors, confirmed
  byte-identical to the frozen upstream fixture. No generated regtest keys,
  cookies, chain/wallet databases or dependency/build directories in history.
  Original Git author attribution is retained. Largest history blob: existing
  screenshot, 388,623 bytes. Current staged source files checked below the
  5,000-token estimate (bytes/4).
- No license chosen. Source context remains frozen at October 21, 2026.
- No deployment, real financial material, transactions on public chains,
  recurring jobs or external messages.

## Remote evidence

- Default branch: `main`; remote implementation SHA matched
  `a05d51cac74513cc198c841b890c960dec0f2fb3` after push.
- [GitHub CI run 39718525717](https://github.com/RahilBhavan/treasury-proof-of-reserves/actions/runs/39718525717)
  passed: lockfile install, JavaScript syntax checks, offline tests, browser
  build, actual artifact checks and offline CLI verification. Actions are pinned
  by commit SHA, Node by version; workflow permissions are `contents: read`.
- A new clone from the public GitHub URL ran `npm ci`, `npm run check`,
  `npm test`, `npm run build:web`, `node scripts/check-browser.mjs`, and
  `node src/cli.js verify examples/bundle.json --offline`: 41 pass, one skip,
  browser artifact valid with three skipped chain checks.
- In that clone, a new Core 31.1 datadir on port 18744 passed all 42 tests.
  `node src/cli.js demo --out .regtest/fresh-bundle.json` generated a
  height-109 snapshot with 22.75 BTC and $2,000,000 fictional liabilities.
  CLI verification passed all checks with no skips. After stop/start, the
  same saved bundle verified completely. Removing its liability witnesses
  produced CLI exit code 1. Private test state remained ignored.
- Publication preserved the original v1 commit and used no force push or PR.
  Public About text/topics describe only the regtest demonstration.
- Remaining limitations: borrowed/encumbered assets, omissions, ownership,
  price and chain-scan assumptions in [verification.md](verification.md).
  No license file yet; no security certification or company wallet claims.
