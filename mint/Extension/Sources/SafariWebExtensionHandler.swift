import SafariServices

/// Required principal class for the web-extension appex. The extension is
/// pure content scripts and never messages the native side, so this just
/// echoes requests back.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let response = NSExtensionItem()
        if let message = (context.inputItems.first as? NSExtensionItem)?
            .userInfo?[SFExtensionMessageKey] {
            response.userInfo = [SFExtensionMessageKey: message]
        }
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
