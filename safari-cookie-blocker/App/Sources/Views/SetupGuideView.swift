import SwiftUI

struct SetupGuideView: View {
    var body: some View {
        List {
            Section("Enable everything once") {
                step(1, "Open Settings",
                     "On iOS 18+: Settings → Apps → Safari → Extensions. On iOS 16–17: Settings → Safari → Extensions.")
                step(2, "Turn on all four extensions",
                     "Ads, Trackers, Annoyances, and Cookie Banner Blocker each have their own switch.")
                step(3, "Allow the cookie extension everywhere",
                     "Tap Cookie Banner Blocker → under Permissions choose All Websites → Allow. The three blockers don't need this step.")
                step(4, "Browse",
                     "Cookie pop-ups get rejected automatically; ads and trackers are blocked. Reload any tabs that were already open.")
            }

            Section("Good to know") {
                Label {
                    Text("Installed with a free Apple ID, the app must be re-run from Xcode every 7 days (Apple's provisioning limit for personal teams).")
                        .font(.footnote)
                } icon: {
                    Image(systemName: "clock")
                }
                Label {
                    Text("Private Browsing has separate extension switches — flip them there too if you want protection in private tabs.")
                        .font(.footnote)
                } icon: {
                    Image(systemName: "hand.raised")
                }
                Label {
                    Text("If a site misbehaves, add it to the Allowlist instead of turning a blocker off globally. You can also use the aA / puzzle-piece menu in Safari's address bar to manage extensions per-site.")
                        .font(.footnote)
                } icon: {
                    Image(systemName: "wrench.and.screwdriver")
                }
            }
        }
        .navigationTitle("Setup Guide")
    }

    private func step(_ number: Int, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.headline)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Color.accentColor.opacity(0.15)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.medium))
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
