# B2C Wealth Venture — Research Programme

**Decision this research serves:** build / no-build, for a *separate venture* (not a Rhinestone product).
**Orchestrator:** main session. Each workstream is its own session; this directory is the shared memory.

## Thesis under test (do not assume it is true)
1. **Self-custody as the custody backbone.** Assets on blockchain rails; tokenization + DeFi power core products. Fiat via licensed partners.
2. **Agentic money management.** Each user has a personal agent working towards their financial objectives.
3. **Structural supply gap.** Target users can't easily access the financial products a well-positioned portfolio needs (e.g. Karta-style credit lines for LATAM users with US assets).
4. **Wedge = time + complexity + access.** No single product covers all needs; users are time-poor.

## Decisions so far (from founder, 2026-11-04)
- **Wealth band:** ~£200k investable and up. The exact persona is an open research question. Access gaps are likely harder to prove at the lower end.
- **Segments to explore in parallel:** (a) emerging-market HNW with an access gap (LATAM-style); (b) developed-market expats/internationals (e.g. London) with a time/complexity gap. Also consider adjacent segments if the evidence points there (e.g. crypto-wealthy, Gulf/Asia internationals).
- **Regulatory entry:** start as an appointed representative / agent of a regulated partner, acquire own licences later.
- **Geography:** open. UK assumed hard given regulation, but test that rather than assume it.
- **Founder's own hunch** (London expat, >£200k, time-poor, unsure how to start) is a sample of one. Treat it as a hypothesis.

## Workstreams
| # | Dir | Question | Phase |
|---|---|---|---|
| 1 | `01-segment` | Which segment/persona has the sharpest, most monetisable gap? | 1 |
| 2 | `02-supply-gap` | What products can't they access, and what can tokenization/DeFi actually deliver today? | 2 |
| 3 | `03-competitive` | Who is closest to this, and why haven't they won? | 1 |
| 4 | `04-rails` | Self-custody / tokenization / DeFi / fiat stack: build vs partner | 2 |
| 5 | `05-regulatory` | Licensing paths, advice rules, custody, tax, by jurisdiction | 1 |
| 6 | `06-agentic` | What's feasible for an agent technically, legally, UX/trust-wise | 2 |
| 7 | `07-business-model` | Revenue, unit economics, distribution | 3 |

## Research standards (all workstreams)
- **Primary sources first.** Regulator rulebooks and statutes, company filings and disclosures, official product pages and T&Cs, credible datasets (e.g. Capgemini World Wealth Report, UBS Global Wealth Report, Knight Frank, Henley, central-bank and regulator stats). Press and blogs only to point you to primary sources, or when nothing better exists (and say so).
- **Cite everything:** URL + date accessed, inline next to the claim.
- **Label each claim:** `[FACT]` (sourced), `[INFERENCE]` (your reasoning from facts), `[OPINION]` (judgement). Add a confidence level (High / Med / Low) to inferences.
- **Steelman the "no".** Every workstream includes a section of evidence *against* the thesis.
- **Don't answer from memory** for anything that changes: products, fees, rules, licences, funding. Verify it live.
- **Recency:** today is 2026-11-04. Flag anything older than 18 months as possibly stale.
- **Flag unknowns** instead of guessing. List what would need primary research (interviews, data purchases).

## Output format (each workstream directory)
- `findings.md`: starts with an executive summary (max 10 bullets, each bullet says what it means for build/no-build), then the detail, then "Evidence against the thesis", "Open questions", "Recommended next research".
- `sources.md`: numbered list with URL, title, publisher, date published, date accessed, and one line on what it supports.
- Optional data files (`.csv`) for tables such as competitor matrices.
