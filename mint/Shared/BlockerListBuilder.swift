import CryptoKit
import Foundation

/// Produces the blocker-list URL a content-blocker extension hands to Safari,
/// merging the static compiled list with the user's allowlist.
///
/// Content-blocker extensions run under a tight memory ceiling, so the merge
/// never JSON-parses the multi-megabyte list. `update-lists.mjs` guarantees
/// the file is a JSON array that ends in `]` with no trailing whitespace, so
/// merging is byte surgery: drop the final `]`, append `,<allow-rule>]`.
/// The appended rule lands after every block rule, which is exactly where
/// `ignore-previous-rules` must sit.
public struct BlockerListBuilder {
    public let category: String // "ads" | "trackers" | "annoyances"
    public let bundle: Bundle

    public init(category: String, bundle: Bundle) {
        self.category = category
        self.bundle = bundle
    }

    /// Never throws to the caller: any failure degrades to the pristine
    /// bundled list (blocking still works, allowlist just isn't applied).
    public func listURL() -> URL? {
        guard let staticURL = bundle.url(forResource: "blockerList", withExtension: "json") else {
            return nil
        }
        guard SharedStore.isEnabled(category: category) else {
            return (try? Self.inertListURL(category: category)) ?? staticURL
        }
        let allowlist = SharedStore.allowlist()
        guard !allowlist.isEmpty else { return staticURL }
        return (try? mergedURL(staticURL: staticURL, allowlist: allowlist)) ?? staticURL
    }

    // MARK: - Merge

    enum BuilderError: Error { case noContainer, malformedStaticList }

    func mergedURL(staticURL: URL, allowlist: [String]) throws -> URL {
        guard let container = SharedStore.containerURL else { throw BuilderError.noContainer }
        let mergedURL = container.appendingPathComponent("merged-\(category).json")
        let stampURL = container.appendingPathComponent("merged-\(category).stamp")

        let stamp = try Self.stamp(allowlist: allowlist, staticURL: staticURL)
        if let old = try? String(contentsOf: stampURL, encoding: .utf8),
           old == stamp,
           FileManager.default.fileExists(atPath: mergedURL.path) {
            return mergedURL
        }

        var data = try Data(contentsOf: staticURL, options: .mappedIfSafe)
        guard data.last == UInt8(ascii: "]") else { throw BuilderError.malformedStaticList }
        data.removeLast()
        data.append(UInt8(ascii: ","))
        data.append(try Self.allowRuleJSON(domains: allowlist))
        data.append(UInt8(ascii: "]"))

        try data.write(to: mergedURL, options: .atomic)
        try stamp.write(to: stampURL, atomically: true, encoding: .utf8)
        return mergedURL
    }

    /// One trailing rule neutralizes everything above it for allowlisted sites:
    /// {"trigger":{"url-filter":".*","if-domain":["*example.com"]},
    ///  "action":{"type":"ignore-previous-rules"}}
    static func allowRuleJSON(domains: [String]) throws -> Data {
        struct Trigger: Encodable {
            let urlFilter = ".*"
            let ifDomain: [String]
            enum CodingKeys: String, CodingKey {
                case urlFilter = "url-filter"
                case ifDomain = "if-domain"
            }
        }
        struct Action: Encodable { let type = "ignore-previous-rules" }
        struct Rule: Encodable {
            let trigger: Trigger
            let action: Action
        }
        let rule = Rule(trigger: Trigger(ifDomain: domains.map { "*\($0)" }), action: Action())
        return try JSONEncoder().encode(rule)
    }

    /// Soft-disabled category: a one-rule list whose trigger can never match a
    /// real URL, so the blocker stays loaded but blocks nothing.
    static func inertListURL(category: String) throws -> URL {
        guard let container = SharedStore.containerURL else { throw BuilderError.noContainer }
        let url = container.appendingPathComponent("inert-\(category).json")
        let inert = #"[{"trigger":{"url-filter":"^cb-disabled-never-matches:$"},"action":{"type":"block"}}]"#
        try inert.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    static func stamp(allowlist: [String], staticURL: URL) throws -> String {
        let attrs = try FileManager.default.attributesOfItem(atPath: staticURL.path)
        let size = (attrs[.size] as? NSNumber)?.stringValue ?? "0"
        let input = allowlist.sorted().joined(separator: "\n") + "|" + size
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
