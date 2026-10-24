# More ways to run it

Purpose: the run commands the README leaves out. Setup and the main regtest run are in the [README](../README.md#run-it).

## Refresh the committed example

`npm run demo` writes `.regtest/bundle.json` (git-ignored). `npm run demo:example` overwrites the committed `examples/bundle.json` instead. Use it only to refresh the example on purpose.

## Offline check

No node needed. On-chain checks are skipped, not passed.

```sh
node src/cli.js verify examples/bundle.json --offline
```

## Adversarial demonstration

No node needed.

```sh
npm run demo:adversarial
```

Nine deterministic cases cover resealed balance inflation, missing witnesses, invalid signatures, stale evidence and malformed chain tips. Simulated-chain checks are labelled. See [adversarial-demo.md](adversarial-demo.md).

## Browser verifier

```sh
npm run build:web                      # writes web/vendor/por.bundle.js
node scripts/check-browser.mjs         # exercises the artifact without Node globals
python3 -m http.server 8000            # then open http://127.0.0.1:8000/web/
```

The page also works from `file://` with the file picker. Only the "Load the example bundle" button needs HTTP.

## GitHub Pages site

`.github/workflows/pages.yml` deploys the same files on each push to `main`.

```sh
npm run build:pages                    # builds and checks the bundle, writes _site/ (git-ignored)
```

`_site/` keeps `web/` and `examples/` side by side, and its `index.html` redirects to `web/`, so the example button works under `/treasury-proof-of-reserves/`.
