#!/bin/sh
# Assemble the GitHub Pages site in _site/. The repo layout is kept (web/ and
# examples/ side by side) so the page's ../examples/bundle.json fetch resolves
# under any base path, including /treasury-proof-of-reserves/.
set -eu
cd "$(dirname "$0")/.."
npm run build:web
node scripts/check-browser.mjs
rm -rf _site
mkdir -p _site/web/vendor _site/web/fonts _site/examples
cp web/index.html web/app.js web/style.css _site/web/
cp web/fonts/* _site/web/fonts/
cp web/vendor/por.bundle.js _site/web/vendor/
cp examples/bundle.json _site/examples/
cat > _site/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Proof-of-reserves bundle verifier (demo)</title>
<meta http-equiv="refresh" content="0; url=web/">
<link rel="canonical" href="web/">
</head>
<body>
<p><a href="web/">Open the proof-of-reserves verifier</a>.</p>
</body>
</html>
HTML
echo "Pages site written to _site/"
