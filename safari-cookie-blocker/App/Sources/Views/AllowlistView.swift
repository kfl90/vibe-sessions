import SwiftUI

struct AllowlistView: View {
    @ObservedObject var allowlist: AllowlistStore
    @ObservedObject var status: BlockerStatusModel
    @State private var newDomain = ""
    @FocusState private var fieldFocused: Bool

    var body: some View {
        List {
            Section {
                HStack {
                    TextField("example.com", text: $newDomain)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($fieldFocused)
                        .onSubmit(addDomain)
                    Button(action: addDomain) {
                        Image(systemName: "plus.circle.fill")
                    }
                    .disabled(newDomain.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } header: {
                Text("Add a site")
            } footer: {
                if let error = allowlist.lastError {
                    Text(error).foregroundStyle(.red)
                } else {
                    Text("Ads, trackers, and annoyances stay unblocked on these sites (including their subdomains). Cookie-banner auto-reject still runs.")
                }
            }

            if !allowlist.domains.isEmpty {
                Section("Allowed sites") {
                    ForEach(allowlist.domains, id: \.self) { domain in
                        Text(domain)
                    }
                    .onDelete { offsets in
                        // Resolve names up front: each removal reindexes the array.
                        for domain in offsets.map({ allowlist.domains[$0] }) {
                            allowlist.remove(domain)
                        }
                        Task { await status.reloadAll() }
                    }
                }
            }
        }
        .navigationTitle("Allowlist")
        .overlay(alignment: .bottom) {
            if status.isReloading {
                ProgressView("Reloading blockers…")
                    .padding(12)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.bottom, 24)
            }
        }
    }

    private func addDomain() {
        let needsReload = allowlist.add(newDomain)
        if allowlist.lastError == nil {
            newDomain = ""
            fieldFocused = false
        }
        if needsReload {
            Task { await status.reloadAll() }
        }
    }
}
