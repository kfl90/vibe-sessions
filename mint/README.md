# Mint — cookie-banner, ad and tracker blocking for Safari on iOS

An iPhone app that plugs into Safari and cleans up the web, 1Blocker/Super-Agent style:

- **Cookie-banner auto-reject** (Safari Web Extension) — detects the major consent platforms (OneTrust, Cookiebot, Quantcast, Didomi, Sourcepoint, TrustArc, Usercentrics, and ~10 more), clicks **"Reject All"** for you so your choice is actually saved, and CSS-hides anything left over. Unknown banners get a conservative multilingual text-matching heuristic.
- **Ads** (Content Blocker) — EasyList, ~72k compiled rules.
- **Trackers** (Content Blocker) — EasyPrivacy, ~55k compiled rules.
- **Annoyances** (Content Blocker) — Fanboy's Annoyance List (includes the cookie list), ~21k compiled rules.
- **App** — live blocker status, per-category pause switches, and a per-site allowlist.

Everything runs on-device. No accounts, no analytics, nothing leaves the phone.

## Building it onto your iPhone

You need a Mac. A **free Apple ID is enough** — no paid developer account required.

### 1. Install Xcode

App Store → search **Xcode** → install (large download). Launch it once and let it install its components.

### 2. Generate the Xcode project

```bash
brew install xcodegen
cd mint
xcodegen generate
open Mint.xcodeproj
```

(No Homebrew? Install from [brew.sh](https://brew.sh) first.)

### 3. Signing

1. Xcode → **Settings → Accounts** → **+** → add your Apple ID (a "Personal Team" appears).
2. Select the **Mint** project in the sidebar, then for **each of the five targets** (Mint, MintCookieBanner, MintAds, MintTrackers, MintAnnoyances): **Signing & Capabilities** → check **Automatically manage signing** → pick your Team.
3. If Xcode complains a bundle ID is taken, change the prefix (`wtf.rhinestone`) to something of yours on **all five targets**, keeping the suffix relationships (`.extension`, `.ads`, `.trackers`, `.annoyances`) intact.
4. If the **App Group** fails to register (group IDs are claimed globally), rename `group.wtf.rhinestone.mint` in **project.yml** (all five occurrences) and in **Shared/SharedStore.swift**, then run `xcodegen generate` again.

### 4. Run on your iPhone

1. Plug the phone in (tap **Trust** on the phone if asked).
2. On the phone: **Settings → Privacy & Security → Developer Mode** → on → restart.
3. In Xcode, pick your iPhone as the run destination and press **▶ Run**.
4. First run: the phone will ask you to trust the developer certificate — **Settings → General → VPN & Device Management** → trust your Apple ID.

> **7-day limit:** apps signed with a free Apple ID expire after 7 days. When that happens, plug in and press Run again — settings and allowlist survive.

### 5. Enable the extensions in iOS

1. **Settings → Apps → Safari → Extensions** (iOS 18+) or **Settings → Safari → Extensions** (iOS 16–17).
2. Turn on all four: **Mint – Ads**, **Mint – Trackers**, **Mint – Annoyances**, **Mint – Cookie Banners**.
3. Tap **Mint – Cookie Banners** → **Permissions** → **All Websites → Allow** (this is what lets the auto-reject script run everywhere; Safari may also show a "Review" banner the first time it runs — allow it).
4. Reload any open tabs. Done.

The app's **Setup Guide** screen walks through the same steps on-device.

## Using the app

- **Protection** — shows whether each blocker is enabled in iOS Settings, plus a pause switch per category that doesn't require a Settings round-trip.
- **Allowlist** — add a domain (e.g. `example.com`) and ads/trackers/annoyances stop being blocked there, subdomains included. The cookie-banner auto-reject deliberately still runs on allowlisted sites — rejecting tracking cookies is almost always what you want even on sites you support.
- Per-site control also exists natively: the **aA / puzzle-piece** menu in Safari's address bar manages extensions for the current site.

## Refreshing the filter lists

The compiled lists are checked into the repo so the Mac build needs nothing but XcodeGen. To pull the latest upstream lists (needs Node ≥ 18):

```bash
cd mint/tools
node update-lists.mjs          # fetch → convert → validate → write
node spot-check.mjs            # sanity-check known-blocked/known-clean URLs
node test-merge.mjs            # verify the allowlist merge invariant
```

Review the printed stats and the git diff, commit, then rebuild the app (an installed app only picks up new lists after a rebuild + reload).

`tools/lists.lock.json` records source URLs, fetch times, and SHA-256 of the raw lists.

## Development & testing (no Mac needed)

The web extension is a self-contained MV3 folder (`Extension/Resources/`) that loads unchanged in Chromium:

```bash
cd mint/tests
npm install
npm test        # 12 fixture tests: real CMP DOM skeletons, iframe + shadow-DOM cases,
                # late injection, heuristic accept-trap test, scroll-lock cleanup, negative test
```

The converter/validator toolchain and the cross-file consistency checks have their own tests:

```bash
cd mint/tools
node lint-project.mjs      # bundle IDs, App Group, and resource paths agree across
                           # project.yml, the Swift, and manifest.json
node test-converter.mjs    # ABP → Safari conversion
node test-merge.mjs        # allowlist merge invariant against the real lists
node spot-check.mjs        # sample URLs blocked / left alone as expected
```

**What can only be verified on-device:** Safari's actual consumption of the content-blocker JSON (Chromium uses a different rule format), extension embedding, and the Settings flow. Quick on-device checks: [d3ward's adblock test](https://d3ward.github.io/toolz/adblock.html) for the blockers; any EU news site for the cookie extension.

## How the allowlist works (technical)

Each content blocker serves Safari its compiled `blockerList.json`. When the allowlist is non-empty, the extension appends one `ignore-previous-rules` rule (scoped via `if-domain`) to the raw bytes of the list — never JSON-parsing 8 MB inside a memory-constrained extension process — writes the merged file to the shared App Group container, and the app calls `SFContentBlockerManager.reloadContentBlocker` so Safari picks it up. The merge result is cached by an SHA-256 stamp of the allowlist.

## Project layout

```
project.yml            XcodeGen spec (5 targets) — .xcodeproj is generated, not committed
App/                   SwiftUI app (status, allowlist, setup guide)
Shared/                SharedStore (App Group storage) + BlockerListBuilder (merge)
Extension/             Cookie-banner auto-reject web extension (MV3, content scripts only)
Blockers/              3 content blockers: shared handler + compiled rule lists
tools/                 List pipeline: fetch → convert (ABP→Safari JSON) → validate
tests/                 Playwright harness + CMP fixtures for the web extension
```

## Filter-list licensing

EasyList, EasyPrivacy, and Fanboy's Annoyance List are © The EasyList authors ([easylist.to](https://easylist.to)), dual-licensed under GPLv3 / CC BY-SA 3.0. The compiled `blockerList.json` files in this repo are derived works redistributed under **CC BY-SA 3.0** — see [LICENSES/FILTER-LISTS.md](LICENSES/FILTER-LISTS.md).

## Future ideas

- **Device-wide tracker firewall** (like 1Blocker's) — needs a Network Extension entitlement, which requires the paid Apple Developer Program.
- **Native messaging** so the cookie extension can respect the allowlist too.
- An element-picker for custom hiding rules.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Extensions don't appear in Settings | Launch the app once, then check again; reboot the phone if needed. |
| Banners still appear | Cookie Banner Blocker permission must be **All Websites → Allow**; check Private Browsing's separate toggles. |
| "Untrusted Developer" alert | Settings → General → VPN & Device Management → trust your certificate. |
| App stopped opening after a week | Free-account signing expired — plug in and Run from Xcode again. |
| App Group registration fails | Rename the group ID (see Signing step 4). Blocking still works without it; only the allowlist and pause switches need it. |
| Blocker shows an error in the app | Usually a reload failure — toggle the blocker off/on in iOS Settings, then relaunch the app. |

### Plan B: building without XcodeGen

If XcodeGen misbehaves, create the project manually: Xcode → New Project → **Safari Extension App** (iOS) → name it, then delete the template's `Resources` content and add this repo's `Extension/Resources/manifest.json` (as a file), `content/` and `images/` (each as **folder references**, blue icons — not groups) to the extension target. Replace the template Swift files with the ones from `App/Sources` and `Extension/Sources`. Add three **Content Blocker Extension** targets, replacing each generated handler with `Blockers/Handler/ContentBlockerRequestHandler.swift`, adding `Shared/*.swift` to their target membership, and each `blockerList.json` as that target's resource. Add the App Group capability to all five targets.
