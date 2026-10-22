# Adversarial verification improvement

Scope authorized by Rahil on 2026-10-22. Starting point: `3ee10d1`, clean
working tree. Read AGENTS.md, CLAUDE.md, DESIGN.md, README, docs/spec.md,
verification and threat model. No glossary or separate ADR directory exists.

Build a deterministic, offline runnable demonstration from the unchanged
fictional regtest example. Show altered balances with recomputed public hashes,
missing liability witnesses, invalid signatures, and stale evidence. Compare
chain-backed outcomes using an explicitly simulated chain with offline outcomes.
Preserve the page, licensed fonts, protocol format, pinned dependencies and data.

Done conditions:

1. `npm run demo:adversarial` prints named scenarios and verifier PASS/FAIL/SKIP
   checks; exits zero only when all observed outcomes match exact expectations.
   JSON output is available and two runs produce identical results.
2. Balance inflation fails against simulated observations but passes offline
   checks with exactly three SKIPs. Missing witnesses and bad signatures fail.
   A snapshot at 144 blocks passes freshness; 145 fails; offline freshness SKIPs.
3. Invalid chain tip values cannot PASS freshness or yield `complete: true`.
   Reproduce the defect before repair; keep an interface-level regression test.
4. Baseline and new tests, syntax checks, web build and browser-artifact checks
   pass. CI runs the adversarial demonstration; record actual results and limits.
5. Document a five-minute example, fixture/source provenance and simulation
   limits. Commit scoped work to the existing main branch, push and inspect CI.

Non-goals: UI changes, new data/services, mainnet activity, ownership attestation,
liability completeness, borrowed/encumbered coin detection, license changes,
publication of messages, hub/sibling changes or nested agents.
