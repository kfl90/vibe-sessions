# Brief: 01 — Segment & ICP

Read `research/README.md` first. It holds the thesis, the founder's decisions and the research standards, and those are binding.

## Goal
Find which customer segment and persona, at **~£200k+ investable**, has the sharpest, most monetisable gap across **time, complexity and access**. Be ready to recommend one primary and one secondary segment.

## Segments to evaluate (minimum)
A. **Emerging-market HNW / affluent with an access gap.** LATAM first (Brazil, Mexico, Argentina, Colombia, Chile). Wants USD assets, offshore diversification, credit against assets. The Karta reference sits here; verify what Karta actually offers from its own site.
B. **Developed-market internationals / expats** (London, but also Dubai, Singapore, Zurich, Lisbon). Multi-currency, multi-jurisdiction tax, pensions and assets spread across countries, time-poor.
C. **Adjacent, if the evidence supports it:** crypto-wealthy who want to diversify without off-ramping, Gulf/Asian internationals, US persons abroad (FATCA makes them toxic to many foreign banks, so they're a possible underserved niche).

## Questions per segment
1. **Size:** number of individuals and total investable wealth in the £200k–£1M, £1M–£5M and £5M+ bands. Use primary datasets and state how each figure is derived.
2. **Current solutions:** what they use today (private bank, local broker, IBKR, offshore account, crypto exchange, nothing) and the entry minimums for the alternatives.
3. **Pains,** ranked across time, complexity and access, with evidence. Look for real user voice: Reddit (r/expatFIRE, r/UKPersonalFinance, r/eupersonalfinance, r/fiaustralia-style communities), expat forums, app-store reviews of incumbents, surveys.
4. **Access gap specifics:** which products they *can't* get, or get only at a bad price (credit lines, US equities and ETFs, private markets, mortgages, dollar yield). This feeds workstream 02.
5. **Willingness to pay:** what they pay today in all-in fees (AUM %, FX spreads, custody fees, advice fees).
6. **Reachability:** channels and communities. Estimate customer acquisition cost from comparable fintechs where public.
7. **Attitude to self-custody / crypto rails:** survey data on HNW crypto adoption by region. Would "self-custody" scare them off or attract them?

## Deliverable
`research/01-segment/findings.md` and `sources.md`, per the README format. Include:
- A **segment scorecard** table (size, pain intensity, access gap, WTP, reachability, crypto-openness, regulatory ease), each rated 1–5 with a justification.
- **2–3 concrete personas** with evidence behind each attribute.
- An honest test of the founder's hunch, i.e. the London expat with £200k+ who is time-poor: how common is this person, and how badly served are they really?
- A list of **10 interview questions** for validating the top segment with real people.

## Out of scope
Deep competitor analysis (03) and regulation (05). Note anything you find there and move on.

## Git
Work on the branch this session was created on. Commit only into `research/01-segment/`. Push when done. Open a draft PR into `claude/vigilant-sagan-ww9i2d`.
