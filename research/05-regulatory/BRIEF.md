# Brief: 05 — Regulatory, Licensing & Tax

Read `research/README.md` first. It holds the thesis, the founder's decisions and the research standards, and those are binding. **Use primary legal sources** (regulator handbooks, statutes, official guidance, register entries). Law-firm briefings are acceptable as secondary sources. Answering from memory isn't acceptable, because this area changes constantly.

## Goal
Find the most viable **jurisdictions and licensing path** for a self-custody-first, tokenization/DeFi-powered wealth product with a personal AI agent, serving £200k+ internationals. The founder's plan is to **start as an agent/appointed representative of a regulated partner, then acquire licences.** Test whether that's viable, and where.

## Jurisdictions (minimum)
UK, EU (MiCA + MiFID II; note passporting hubs such as Lithuania, Ireland, Luxembourg, Malta), Switzerland, UAE (VARA / ADGM / DIFC), Singapore (MAS), US (as a distribution/asset-origination constraint), and the LATAM serving regime: Brazil, Mexico, Argentina. Specifically, the rules on **reverse solicitation / cross-border marketing** of foreign investment products to their residents.

## Questions per jurisdiction
1. **Advice:** where's the line between guidance/information and a personal recommendation? Can an AI agent give advice, and under whose licence? Any AI-specific guidance from the regulator?
2. **Discretionary execution:** what licence is needed for an agent to *act* (portfolio management)? Does user-signed, self-custodial execution change the analysis (e.g. non-custodial wallet exemptions, MiCA's treatment of non-custodial services)?
3. **Appointed rep / agent model:** does the regime exist (e.g. UK AR regime post-2022 reforms, EU tied agents, Swiss equivalents)? What are the principal's obligations, typical commercial terms, and examples of firms offering principal-as-a-service?
4. **Custody / crypto-asset rules:** is self-custody tooling regulated? Rules on offering tokenized securities and stablecoins to retail versus professional/HNW clients.
5. **HNW / professional client exemptions:** thresholds (e.g. UK certified HNW and sophisticated investors, EU elective professional, Singapore accredited investor, UAE professional client) and what they unlock.
6. **Credit:** licensing for lending against assets (Lombard / crypto-backed), and consumer credit rules.
7. **Consumer protection:** e.g. UK Consumer Duty and financial promotions regime for crypto. How heavy is this, practically?
8. **Time and cost** to obtain the relevant licences, using real examples where available.

## Tax (overview, not advice)
- Key frictions for the target users: UK FIG regime replacing non-dom (verify the current rules), US persons abroad (FATCA/PFIC), CRS reporting, and how tokenized assets and DeFi yield are taxed in the top 3 candidate jurisdictions.
- Could tax-aware automation be a product moat, or is it a liability?

## Deliverable
`research/05-regulatory/findings.md` and `sources.md`. Include:
- A **jurisdiction matrix:** feasibility (1–5), time to market, cost, AR/agent route available Y/N, HNW-exemption leverage, and the key blocker.
- The **recommended entry structure:** where to incorporate, whose licence to ride, which users to serve first, and a licensing roadmap.
- **Red lines:** the things that would make the thesis non-viable (e.g. an agent with execution being treated as discretionary management in every jurisdiction).
- Test the founder's assumption that "the UK will be tough", including both what makes it hard and what might make it good (e.g. the FCA AI Lab, sandbox).

## Out of scope
Competitor deep dives (03) and segment sizing (01).

## Git
Work on the branch this session was created on. Commit only into `research/05-regulatory/`. Push when done. Open a draft PR into `claude/vigilant-sagan-ww9i2d`.
