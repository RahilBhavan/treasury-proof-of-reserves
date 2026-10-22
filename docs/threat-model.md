# Threat model: what this proof shows and what it does not

Purpose: state exactly what a passing `tpor-bundle/v1` proves, what it cannot prove, and how a privacy-preserving version would differ. Sources are in [research.md](research.md).

## Setting

A public bitcoin-treasury company wants to show that its bitcoin covers its senior claims (convertible notes, preferred stock liquidation preference, loans) at a block height H, without publishing a full wallet list. Its liabilities are mostly public in aggregate through SEC filings; its custody addresses are not. Strategy, for example, names three custodians in its FY2025 10-K but publishes no addresses, and its chairman has called on-chain proof of reserves "a bad idea" for security reasons.

Parties: the **prover** (the company), **creditors** (each holder or trustee of a liability instrument), and **verifiers** (anyone with the bundle and, for the on-chain checks, a node).

## What a fully passing bundle proves

With `node src/cli.js verify` against a node (all checks `PASS`, none `SKIP`):

1. **Key control at signing time.** For each listed address, someone who controlled its key signed the challenge (BIP-322 *simple*). The challenge contains the block hash at H, so the signature was made after block H existed.
2. **No replay across snapshots.** The challenge also contains the network, the height, the liabilities root and a nonce. A signature from another snapshot, chain or liability set fails.
3. **Balances at H.** The sum of the listed addresses' unspent outputs at height H equals the claimed figure. This is computed from the chain, not taken from the bundle.
4. **No double counting by address.** No output script appears twice, including the same bech32 address in another letter case.
5. **Freshness.** H is on the verifier's chain (no reorg) and at most `maxAgeBlocks` below the tip (default 144, about one day).
6. **Liability inclusion.** At least one inclusion witness is required to bind the root sum to the signed hash. Each disclosed leaf (instrument, notional, salt) is in the tree whose root total is the published liability figure. Because each node commits to both child sums, the prover cannot lower the total by shifting value between siblings, and negative sums are rejected.
7. **Integrity of the report.** Report inputs are hash-committed, and the report's arithmetic (assets x stated price vs. liabilities) recomputes. These are publicly recomputable checksums, not issuer authentication. The asset signatures bind the liability root hash and snapshot, but do not sign balances or price. See [spec.md](spec.md). Leaf count and proof index are descriptive metadata.

## What it does not prove

| Gap | Why | What would narrow it |
|---|---|---|
| **Borrowed coins** | Coins can be lent to the prover for block H and returned at H+1. The regtest test shows both cases: coins arriving after H are not counted, while coins spent after H still count at H. | Require the coins to stay unspent across a window (H-k to H+k), or use repeated, unannounced snapshots. |
| **Ownership vs. control** | A signature shows key control, not beneficial ownership. A custodian, lender or affiliate can sign for coins that are pledged elsewhere. | Custodian attestations with legal liability; disclosure of encumbrances (liens, rehypothecation). |
| **Omitted liabilities** | The tree covers only the leaves the prover put in. A creditor who never checks their leaf cannot detect omission. | Each creditor or trustee checks their leaf; reconcile the root total to the audited balance sheet. |
| **Off-tree liabilities** | Derivatives, guarantees, leases, tax and contingent claims are not instruments in the tree. | Auditor sign-off that the tree total matches reported liabilities. |
| **Seniority** | The report compares one total to one total. A treasury company's claims have an order (secured loan before notes before preferred). | Per-tranche coverage: cumulative liabilities by seniority vs. assets. |
| **Price** | The BTC/USD price is a committed input, not an oracle. A wrong price passes. | Commit to a named reference rate and time (for example the closing rate the company uses in its filings). |
| **Liquidity** | Bitcoin at H is not cash at maturity. | Out of scope for a reserve proof. |
| **Key compromise or coercion** | A valid signature does not show the keys are safe. | Out of scope. |
| **The browser verifier alone** | The static page cannot reach a node, so it marks block hash, freshness and balances as `SKIP`. A page showing only browser checks proves signatures and arithmetic, not balances. | Run the CLI against your own node, or add an indexer source. |

## Privacy costs of this design

- **Assets are fully public.** Every address in the bundle is linkable forever, together with its history and future spends. This is the exposure Strategy's chairman objected to.
- **Address reuse makes it worse.** Signing for long-lived cold-storage addresses ties all their past and future activity to the company.
- **Liability leaves are salted**, so a third party cannot test-guess one leaf's contents from its hash. But a creditor's proof path reveals sibling sums, and the leaf count reveals roughly how many instruments exist. For a public company these totals are already in filings, so the leak is small.

## A privacy-preserving version (design notes only; not implemented)

The goal is to prove "assets at H >= liabilities at H" without revealing which UTXOs, or how much bitcoin, beyond what the company chooses.

1. **Asset side.** Instead of listing addresses, the prover builds a commitment to each owned UTXO's amount (a Pedersen commitment `C_i = a_i*G + r_i*H`). It proves in zero knowledge that each committed UTXO is in the UTXO set at H (membership in a set derived from the block, for example a Merkle or accumulator root over all P2TR or P2WPKH outputs), that it knows the private key, and that no UTXO is counted twice (a key-image or nullifier per UTXO, as in Provisions by Dagher, Bünz, Bonneau, Clark and Boneh, https://eprint.iacr.org/2015/1008, 2015, accessed 2026-10-21). Commitments add up homomorphically to a total `C_A`.
2. **Liability side.** Leaves hold Pedersen commitments instead of plain notionals. Each node carries a commitment to its sum and a **range proof** that the sum is non-negative and below a bound. Without range proofs, a negative hidden leaf could cancel a real liability. Each creditor still checks their own leaf.
3. **Solvency.** The prover shows `C_A x price - C_L` commits to a non-negative value with one range proof (Bulletproofs need no trusted setup). The verifier learns only "assets >= liabilities", or a coverage band if the company chooses to reveal it.
4. **What changes.** Verification needs the full UTXO set at H (or a trusted commitment to it) instead of a few address lookups. Proving cost grows with the anonymity set. The borrowed-coins, omission and price gaps above stay exactly the same, because ZK hides data but does not add facts. Custodied coins still need the custodian to take part.

Binance's PoR uses a zk-SNARK for the liability side (non-negative balances, all accounts in the total). Its asset side is still a list of addresses.
