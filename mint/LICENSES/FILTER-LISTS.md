# Filter List Attribution & Licensing

The compiled rule files in this repository —

- `Blockers/Ads/Resources/blockerList.json` (derived from **EasyList**)
- `Blockers/Trackers/Resources/blockerList.json` (derived from **EasyPrivacy**)
- `Blockers/Annoyances/Resources/blockerList.json` (derived from **Fanboy's Annoyance List**, which incorporates the EasyList Cookie List)

— are machine-converted derivatives of filter lists that are
**© The EasyList authors** (<https://easylist.to>) and contributors,
dual-licensed under the
[GNU General Public License v3](https://www.gnu.org/licenses/gpl-3.0.html)
and the
[Creative Commons Attribution-ShareAlike 3.0 Unported license](https://creativecommons.org/licenses/by-sa/3.0/).

These derived files are redistributed here under **CC BY-SA 3.0**:

- **Attribution** — The EasyList authors, <https://easylist.to>. Upstream source
  URLs and content hashes for each conversion are recorded in
  [`tools/lists.lock.json`](../tools/lists.lock.json).
- **ShareAlike** — the derived `blockerList.json` files remain available under
  CC BY-SA 3.0. If you modify and redistribute them, you must do the same.

The conversion tooling in `tools/` is original code in this repository and is
not derived from the filter lists.

The changes made during conversion are format-mechanical: Adblock-Plus filter
syntax is translated to Apple's Safari content-blocker JSON schema; filters
that Safari cannot express (extended CSS selectors, snippet filters, `$csp`,
`$redirect`, `$removeparam`, regex filters, etc.) are omitted; generic hiding
selectors are coalesced into combined rules.
