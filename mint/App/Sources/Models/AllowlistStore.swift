import SwiftUI

/// App-side wrapper over the shared allowlist with input validation.
@MainActor
final class AllowlistStore: ObservableObject {
    @Published private(set) var domains: [String] = []
    @Published var lastError: String?

    init() {
        reload()
    }

    func reload() {
        domains = SharedStore.allowlist()
    }

    /// Returns true when a reload of the blockers is needed.
    func add(_ raw: String) -> Bool {
        guard let normalized = SharedStore.normalize(raw) else {
            lastError = "\u{201C}\(raw)\u{201D} doesn't look like a domain. Try something like example.com."
            return false
        }
        lastError = nil
        guard !domains.contains(normalized) else { return false }
        _ = SharedStore.addToAllowlist(normalized)
        reload()
        return true
    }

    func remove(_ domain: String) {
        SharedStore.removeFromAllowlist(domain)
        reload()
    }
}
