import SafariServices
import SwiftUI

/// Live state of the three content blockers plus the reload plumbing.
///
/// iOS owns hard enable/disable (Settings → Apps → Safari → Extensions); the
/// app can only read that state. The in-app "soft toggle" swaps the list the
/// blocker serves for an inert one and reloads.
@MainActor
final class BlockerStatusModel: ObservableObject {
    enum State: Equatable {
        case unknown
        case enabled
        case disabled
        case error(String)
    }

    @Published private(set) var states: [BlockerID: State] = [:]
    @Published private(set) var isReloading = false

    // MARK: - SFContentBlockerManager wrappers
    // Completion-handler forms wrapped in continuations: guaranteed available
    // at the iOS 16 deployment target.

    private func stateOfBlocker(_ blocker: BlockerID) async throws -> Bool {
        try await withCheckedThrowingContinuation { continuation in
            SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: blocker.rawValue) { state, error in
                if let state {
                    continuation.resume(returning: state.isEnabled)
                } else {
                    continuation.resume(throwing: error ?? CocoaError(.featureUnsupported))
                }
            }
        }
    }

    private func reloadBlocker(_ blocker: BlockerID) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            SFContentBlockerManager.reloadContentBlocker(withIdentifier: blocker.rawValue) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Public API

    func refreshStates() async {
        for blocker in BlockerID.allCases {
            do {
                states[blocker] = try await stateOfBlocker(blocker) ? .enabled : .disabled
            } catch {
                states[blocker] = .error(error.localizedDescription)
            }
        }
    }

    /// Called after every allowlist mutation or soft-toggle flip.
    func reloadAll() async {
        isReloading = true
        defer { isReloading = false }
        for blocker in BlockerID.allCases {
            try? await reloadBlocker(blocker)
        }
        await refreshStates()
    }

    func setCategoryEnabled(_ on: Bool, _ blocker: BlockerID) async {
        SharedStore.setEnabled(on, category: blocker.category)
        isReloading = true
        defer { isReloading = false }
        try? await reloadBlocker(blocker)
    }
}
