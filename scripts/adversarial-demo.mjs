// A demo assertion PASS means the verifier matched the expected outcome,
// including expected verifier FAILs. It does not mean the attacked bundle passed.
import { readFileSync } from 'node:fs';
import { runAdversarialDemo } from './adversarial-cases.mjs';

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--json') || args.length > 1) {
    throw new Error('usage: node scripts/adversarial-demo.mjs [--json]');
  }
  const bundle = JSON.parse(readFileSync(new URL('../examples/bundle.json', import.meta.url), 'utf8'));
  const demo = await runAdversarialDemo(bundle);
  if (args.includes('--json')) console.log(JSON.stringify(demo, null, 2));
  else {
    console.log(`FICTIONAL REGTEST ADVERSARIAL DEMO\n${demo.evidence}`);
    console.log('PASS = check passed; FAIL = rejected; SKIP = not checked.');
    console.log('Demo assertions compare expected failures/skips; offline ok is never complete.\n');
    for (const s of demo.scenarios) {
      console.log(`${s.id}: ${s.note}`);
      for (const c of s.result.checks) console.log(`  ${c.status.toUpperCase().padEnd(4)} ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
      console.log(`  verdict: ok=${s.result.ok}, complete=${s.result.complete}; ${s.result.failed} FAIL, ${s.result.skipped} SKIP`);
      console.log(`  expectation ${s.matches ? 'MATCH' : 'MISMATCH'}: ${s.expected.failures.length} FAIL, ${s.expected.skips.length} SKIP\n`);
    }
    console.log(`${demo.matched ? 'PASS' : 'FAIL'} demo assertions: ${demo.scenarios.filter((s) => s.matches).length}/${demo.scenarios.length} expectations matched.`);
    console.log('No verdict establishes ownership, complete liabilities, unborrowed/unencumbered coins or a correct price.');
  }
  process.exitCode = demo.matched ? 0 : 1;
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
