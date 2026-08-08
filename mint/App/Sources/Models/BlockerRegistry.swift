import Foundation

/// The three content-blocker extensions. Raw values must match the
/// PRODUCT_BUNDLE_IDENTIFIER of each blocker target in project.yml.
enum BlockerID: String, CaseIterable, Identifiable {
    case ads = "wtf.rhinestone.mint.ads"
    case trackers = "wtf.rhinestone.mint.trackers"
    case annoyances = "wtf.rhinestone.mint.annoyances"

    var id: String { rawValue }

    /// SharedStore category key — the last bundle-ID component, mirroring how
    /// ContentBlockerRequestHandler derives it.
    var category: String { rawValue.components(separatedBy: ".").last ?? rawValue }

    var title: String {
        switch self {
        case .ads: return "Ads"
        case .trackers: return "Trackers"
        case .annoyances: return "Annoyances"
        }
    }

    var subtitle: String {
        switch self {
        case .ads: return "EasyList — banners, video ads, ad frames"
        case .trackers: return "EasyPrivacy — analytics and tracking pixels"
        case .annoyances: return "Fanboy's Annoyance — popups, widgets, cookie-notice leftovers"
        }
    }

    var symbolName: String {
        switch self {
        case .ads: return "rectangle.slash"
        case .trackers: return "eye.slash"
        case .annoyances: return "hand.raised"
        }
    }
}
