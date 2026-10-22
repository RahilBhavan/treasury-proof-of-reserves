// Wires the page to the bundled verifier (global TPOR from vendor/por.bundle.js).
const $ = (id) => document.getElementById(id);

const fmtBtc = (sats) => `${(sats / 1e8).toLocaleString('en-US', { minimumFractionDigits: 8 })} BTC`;
const fmtUsd = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function row(label, value) {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  const td = document.createElement('td');
  th.scope = 'row';
  th.textContent = label;
  td.textContent = value;
  tr.append(th, td);
  return tr;
}

async function show(text) {
  let bundle;
  try { bundle = JSON.parse(text); }
  catch (e) { return render({ error: `Not valid JSON: ${e.message}` }); }
  let result;
  try { result = await TPOR.verifyBundle(bundle); }
  catch (e) { return render({ error: `Bundle could not be read: ${e.message}` }); }
  render({ bundle, result });
}

function render({ bundle, result, error }) {
  $('result').hidden = false;
  const verdict = $('verdict');
  const summary = $('summary');
  const checks = $('checks');
  summary.replaceChildren();
  checks.replaceChildren();
  if (error) {
    verdict.className = 'verdict fail';
    verdict.textContent = error;
    return;
  }
  if (!result.ok) {
    verdict.className = 'verdict fail';
    verdict.textContent = `Invalid: ${result.failed} check${result.failed === 1 ? '' : 's'} failed.`;
  } else {
    verdict.className = 'verdict partial';
    verdict.textContent = `Valid in the browser. ${result.skipped} on-chain check${result.skipped === 1 ? ' was' : 's were'} skipped.`;
  }
  const r = bundle.report || {};
  summary.append(
    row('Entity', bundle.entity),
    row('Network / height', `${bundle.network} / ${bundle.snapshot?.height}`),
    row('Block hash', bundle.snapshot?.block_hash),
    row('Assets (claimed)', `${fmtBtc(r.assets_sats)} across ${bundle.assets?.proofs?.length} addresses`),
    row('Price input', `${fmtUsd(bundle.price?.usd_cents_per_btc)} per BTC (${bundle.price?.source})`),
    row('Assets at that price', fmtUsd(r.assets_usd_cents)),
    row('Liabilities (tree total)', `${fmtUsd(r.liabilities_usd_cents)} in ${bundle.liabilities?.root?.leaf_count} leaves`),
    row('Coverage', r.coverage_bps == null ? 'n/a' : `${(r.coverage_bps / 100).toFixed(2)}%`),
    row('Bundle digest', bundle.bundle_digest),
  );
  for (const c of result.checks) {
    const li = document.createElement('li');
    li.className = c.status;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = c.status;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.name;
    li.append(tag, name);
    if (c.detail) {
      const d = document.createElement('span');
      d.className = 'detail';
      d.textContent = c.detail;
      li.append(d);
    }
    checks.append(li);
  }
}

$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (f) show(await f.text());
});
$('verify-paste').addEventListener('click', () => show($('paste').value));
$('example').addEventListener('click', async () => {
  try {
    const res = await fetch('../examples/bundle.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    show(await res.text());
  } catch (e) {
    render({ error: `Could not fetch the example (${e.message}). Serve the repo over HTTP, or choose examples/bundle.json with the file picker.` });
  }
});
