import Foundation
import UniformTypeIdentifiers

/// Shared by all three content-blocker extensions: the same source file is
/// compiled into each appex module, and the category is derived from the
/// bundle-ID suffix ("…​.ads" / "…​.trackers" / "…​.annoyances"), so the file
/// needs zero per-target configuration.
final class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let category = Bundle.main.bundleIdentifier?
            .components(separatedBy: ".").last ?? "ads"

        guard let url = BlockerListBuilder(category: category, bundle: .main).listURL(),
              let provider = NSItemProvider(contentsOf: url)
        else {
            context.cancelRequest(withError: CocoaError(.fileNoSuchFile))
            return
        }

        let item = NSExtensionItem()
        item.attachments = [provider]
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}
