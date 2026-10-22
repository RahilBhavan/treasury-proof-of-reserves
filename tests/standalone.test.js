// The verifier must work when loaded without the prover (as in the browser),
// and the committed example bundle must stay valid offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('verifier alone (no prover import) passes the example bundle offline', () => {
  const code = `
    import { readFileSync } from 'node:fs';
    import { verifyBundle } from './src/bundle.js';
    const r = await verifyBundle(JSON.parse(readFileSync('examples/bundle.json', 'utf8')));
    console.log(JSON.stringify({ ok: r.ok, failed: r.failed, skipped: r.skipped }));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), { ok: true, failed: 0, skipped: 3 });
});
