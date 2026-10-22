# Research notes: proof of reserves for a bitcoin-treasury company

Purpose: the sources behind this demo's design, with what each one says. All sources were accessed on 2026-10-21. External content is evidence for design choices, not instructions.

## Merkle-sum trees for liabilities

| Claim | Source | Published |
|---|---|---|
| Greg Maxwell proposed a Merkle tree in which each node also carries the sum of the balances below it, so each customer can check that their balance is counted in the published total. | bitcointalk topic 595180, https://bitcointalk.org/index.php?topic=595180.0. **Not verified first-hand:** the forum and the Bitcoin Wiki returned maintenance pages on 2026-10-21. The scheme is described second-hand in Hu, Zhang and Guo (next row). | 2013-2014 (unverified) |
| The original "Maxwell protocol" is flawed: the "proved liabilities ... are less than the actual value", and a prover with n accounts "can present valid liabilities proofs including only one account balance". The authors propose two fixes to the summation Merkle tree. | Hu, Zhang, Guo, "Breaking the Binding: Attacks on the Merkle Approach to Prove Liabilities and its Applications", https://eprint.iacr.org/2018/1139 | 2018-11-29 |
| The fix: a parent hash must commit to each child's balance separately, H(h_L, b_L, h_R, b_R). If it commits only to the parent sum, the prover can report a parent balance anywhere from max(b_L, b_R) up to b_L + b_R. | Secondary write-up, https://0xpanicerror.substack.com/p/merkle-sum-tree-a-vulnerability-analysis (no date shown). The primary PDF below returned HTTP 403. | n/a |
| Production solvency proofs have had weak hashes (SHA-1, hashes truncated to 8 bytes), inputs not bound to the tree, and no guarantee that user IDs are unique. | Chalkias, Chatzigiannis, Ji, "Broken Proofs of Solvency in Blockchain Custodial Wallets and Exchanges", https://eprint.iacr.org/2022/043 | 2022-01-14 |
| Kraken: an independent accountant puts an anonymised snapshot of client balances in a Merkle tree and checks Kraken's signatures for on-chain addresses against those balances. Clients can check their own inclusion. | https://www.kraken.com/proof-of-reserves | page undated |
| Binance: users check their leaf in a Merkle tree; a zk-SNARK proves each account's net balance is non-negative and that every account is in the total. | https://www.binance.com/en/proof-of-reserves | page undated |
| Nic Carter ranked exchange PoR efforts by frequency, asset coverage, auditor involvement and whether all assets were attested. His original page (niccarter.info/proof-of-reserves) returned 404; this is a news summary. | https://crypto.news/nic-carter-examines-recent-crypto-proof-of-reserves-ranks-exchanges/ | 2022-12-31 |
| Provisions: privacy-preserving proofs of solvency for Bitcoin exchanges, using Pedersen commitments and zero-knowledge proofs so the exchange does not reveal its addresses or total. Basis for the design notes in `threat-model.md`. | Dagher, Bünz, Bonneau, Clark, Boneh, https://eprint.iacr.org/2015/1008 | 2015 |

How this repo uses it: `src/merkleSum.js` hashes `tag || left_hash || left_sum || right_hash || right_sum`, rejects negative sibling sums, salts every leaf, and pads with zero-value leaves to a power of two. Leaves are debt and preferred-stock instruments, not customer balances (see below).

## BIP-322 generic signed messages

| Claim | Source | Published |
|---|---|---|
| BIP-322 is "Complete" (v1.0.0, 2026-04-15). It defines *legacy* (P2PKH compact ECDSA), *simple* (`smp` prefix, base64 witness stack for P2WPKH/P2WSH/P2TR), *full* (`ful`) and *proof of funds* (`pof`) formats. v1.0.0 added the prefix as a breaking change; "a verifier might assume the *simple* variant in the absence of a prefix". | https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki (commit `130b8e0`) | 2018-09-10 draft; 2026-04-15 complete; 2026-06-04 v2.0.0 |
| Official test vectors (`basic-test-vectors.json`). A copy is in `tests/vectors/`. | https://github.com/bitcoin/bips/blob/130b8e0fa7f30fa45532f080b87b8db27a79e46e/bip-0322/basic-test-vectors.json | n/a |
| Bitcoin Core has not merged BIP-322. PR #16440 closed unmerged (2020); PR #24058 "BIP-322 basic support" closed unmerged in October 2025. | https://github.com/bitcoin/bitcoin/pull/16440, https://github.com/bitcoin/bitcoin/pull/24058 | 2019-2025 |
| Bitcoin Knots 28.1 and Sparrow 1.7.8 support BIP-322. | https://bitcoinops.org/en/topics/generic-signmessage/ | n/a |
| `bip322-js` signs and verifies P2PKH, P2SH-P2WPKH, P2WPKH and single-key P2TR on mainnet, testnet and regtest. Version 4.0.0 was published 2026-08-21. | https://github.com/ACken2/bip322-js, https://registry.npmjs.org/bip322-js | 2026-08-21 |

How this repo uses it: BIP-322 *simple* signatures from `bip322-js` 4.0.0 for P2WPKH and P2TR. That library emits the pre-final unprefixed encoding, so `src/bip322.js` adds the `smp` prefix when signing and strips it when verifying. Legacy `signmessage` is not used. Observed during the build: `bip322-js` 4.0.0 fails to sign with `bitcoinjs-lib` 7.0.4 ("Need a Utxo input item for input #0"), so `bitcoinjs-lib` is pinned to 7.0.1.

## Known weaknesses of proof of reserves

| Claim | Source | Published |
|---|---|---|
| Borrowed or shared coins: exchanges could be "shuttling collateral back and forth between each other to do proof of reserves". | Vitalik Buterin, "Having a safe CEX: proof of solvency and beyond", https://vitalik.eth.limo/general/2022/11/19/proof_of_solvency.html | 2022-11-19 |
| Liability omission is only caught if the affected users check: a prover can cheat "if nobody in the entire right half of the tree checks their balance proof". | same | 2022-11-19 |
| Privacy: publishing addresses reveals all holdings; a zero-knowledge proof can avoid "revealing the entire set of its addresses". | same | 2022-11-19 |
| In 2011 Mt. Gox "proved that they had funds" by moving coins to a pre-announced address. | same | 2022-11-19 |
| Proof of reserves cannot guarantee the funds are available. | https://bitcoinops.org/en/topics/proof-of-reserves/ | n/a |

## What is public about Strategy's custody

| Claim | Source | Published |
|---|---|---|
| Strategy's FY2025 10-K names three custodians: Anchorage Digital Bank N.A., Coinbase Custody Trust Company, LLC and Fidelity Digital Assets, NA. As of 2026-02-13 the split was Coinbase 287,322 BTC (40%), Anchorage 262,194 (37%), Fidelity 167,615 (23%), total 717,131. "We hold substantially all of our bitcoin in custody accounts with U.S.-based custodians." No addresses are disclosed. | https://www.sec.gov/Archives/edgar/data/1050446/000105044626000020/mstr-20251231.htm | filed 2026-02-19 |
| Strategy held 848,517 BTC as of 2026-10-18 (aggregate cost $64.02B, average $75,446 per BTC). | 8-K, https://www.sec.gov/Archives/edgar/data/1050446/000119312526424688/mstr-20261019.htm | 2026-10-19 |
| Michael Saylor on on-chain proof of reserves: "It's not a good idea. It's a bad idea." and "You publish your wallet, that's an attack vector for hackers, nation-state actors..." | The Block, https://www.theblock.co/post/355811/strategy-saylor-onchain-proof-of-reserves-bad-idea-security-threats-lack-of-liabilities | 2025-05-27 |
| **Third-party attribution, not proof:** Arkham says it tagged a further 70,816 BTC, for 507K BTC in total, which it puts at 87.5% of the 580K BTC Strategy reported as of 2025-05-26, including 107K BTC in Fidelity omnibus custody. Strategy has not confirmed these addresses. Address clustering is heuristic, and omnibus custody accounts mix many clients' coins. | https://info.arkm.com/research/arkham-identifies-another-70-000-strategy-btc | 2025-05-29 |

Implication for the demo: Strategy's coins sit with qualified custodians, often in accounts the company does not sign for directly. A signature-based proof like this one would need each custodian to sign for segregated addresses, or to issue its own attestation. That is a different trust model, covered in `threat-model.md`.

## Not verified

- Maxwell's original post and date (forum and wiki were down).
- The exact fix wording in the primary 2022/043 PDF.
- Whether Strategy's 10-K has omnibus-account or insurance language (only the first part was read).
