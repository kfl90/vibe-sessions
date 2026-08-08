import SwiftUI

struct RootView: View {
    @StateObject private var status = BlockerStatusModel()
    @StateObject private var allowlist = AllowlistStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            List {
                Section {
                    BlockerStatusSection(status: status)
                } header: {
                    Text("Protection")
                } footer: {
                    Text("Blockers are switched on in Settings → Apps → Safari → Extensions. The in-app switch pauses a blocker without visiting Settings.")
                }

                Section {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Cookie Banner Auto-Reject")
                            Text("Clicks \u{201C}Reject All\u{201D} on consent pop-ups for you and hides the leftovers. Enable it alongside the blockers and allow it on All Websites.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "checkmark.shield")
                            .foregroundStyle(.green)
                    }
                } header: {
                    Text("Cookie Banners")
                } footer: {
                    Text("The auto-reject extension always runs — the allowlist below only affects blocking.")
                }

                Section("Allowlist") {
                    NavigationLink {
                        AllowlistView(allowlist: allowlist, status: status)
                    } label: {
                        HStack {
                            Label("Allowed Sites", systemImage: "checkmark.circle")
                            Spacer()
                            Text("\(allowlist.domains.count)")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Help") {
                    NavigationLink {
                        SetupGuideView()
                    } label: {
                        Label("Setup Guide", systemImage: "questionmark.circle")
                    }
                    NavigationLink {
                        AboutView()
                    } label: {
                        Label("About & Licenses", systemImage: "info.circle")
                    }
                }
            }
            .navigationTitle("Mint")
            .overlay(alignment: .bottom) {
                if status.isReloading {
                    ProgressView("Reloading blockers…")
                        .padding(12)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                        .padding(.bottom, 24)
                }
            }
        }
        .task { await status.refreshStates() }
        .onChange(of: scenePhase) { phase in
            // Users bounce to Settings and back — refresh on every return.
            if phase == .active {
                Task { await status.refreshStates() }
            }
        }
    }
}

struct AboutView: View {
    var body: some View {
        List {
            Section("Blocking Lists") {
                Text("Ad, tracker, and annoyance blocking uses rules compiled from EasyList, EasyPrivacy, and Fanboy's Annoyance List — © The EasyList authors (easylist.to), used under the Creative Commons Attribution-ShareAlike 3.0 license.")
                    .font(.footnote)
            }
            Section("Privacy") {
                Text("Everything runs on this device. No browsing data, no analytics, nothing leaves your phone.")
                    .font(.footnote)
            }
        }
        .navigationTitle("About")
    }
}
