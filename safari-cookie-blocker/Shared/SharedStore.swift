import Foundation

/// App-Group-backed storage shared between the app and every extension.
/// The group ID is the single source of truth here; project.yml references
/// the same value in the entitlements of each target. If registration of the
/// group fails on your Apple ID (IDs are claimed globally), change it in both
/// places, keeping the "group." prefix.
public enum SharedStore {
    public static let appGroupID = "group.wtf.rhinestone.cookieblocker"

    static let allowlistKey = "allowlistedDomains"
    static func enabledKey(_ category: String) -> String { "enabled.\(category)" }

    public static var defaults: UserDefaults? { UserDefaults(suiteName: appGroupID) }

    public static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID)
    }

    // MARK: - Allowlist

    public static func allowlist() -> [String] {
        defaults?.stringArray(forKey: allowlistKey) ?? []
    }

    public static func setAllowlist(_ domains: [String]) {
        let cleaned = Set(domains.compactMap(normalize)).sorted()
        defaults?.set(cleaned, forKey: allowlistKey)
    }

    public static func addToAllowlist(_ raw: String) -> String? {
        guard let domain = normalize(raw) else { return nil }
        var current = allowlist()
        guard !current.contains(domain) else { return domain }
        current.append(domain)
        setAllowlist(current)
        return domain
    }

    public static func removeFromAllowlist(_ domain: String) {
        setAllowlist(allowlist().filter { $0 != domain })
    }

    // MARK: - Soft category toggles (default: on)

    public static func isEnabled(category: String) -> Bool {
        defaults?.object(forKey: enabledKey(category)) as? Bool ?? true
    }

    public static func setEnabled(_ on: Bool, category: String) {
        defaults?.set(on, forKey: enabledKey(category))
    }

    // MARK: - Domain normalization

    /// "https://www.Example.com/page?x=1" → "example.com"; returns nil for
    /// input that doesn't look like a domain.
    public static func normalize(_ raw: String) -> String? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !s.isEmpty else { return nil }
        if let schemeRange = s.range(of: "://") {
            s = String(s[schemeRange.upperBound...])
        }
        s = s.components(separatedBy: "/").first ?? s
        s = s.components(separatedBy: "?").first ?? s
        s = s.components(separatedBy: ":").first ?? s
        if s.hasPrefix("www.") { s.removeFirst(4) }
        guard !s.isEmpty, s.contains("."), !s.hasPrefix("."), !s.hasSuffix("."),
              s.range(of: "^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$", options: .regularExpression) != nil
        else { return nil }
        return s
    }
}
