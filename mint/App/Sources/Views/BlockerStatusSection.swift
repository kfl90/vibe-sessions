import SwiftUI

/// One row per content blocker: iOS-Settings state badge plus the in-app
/// soft toggle (interactive only when the blocker is enabled in Settings).
struct BlockerStatusSection: View {
    @ObservedObject var status: BlockerStatusModel

    var body: some View {
        ForEach(BlockerID.allCases) { blocker in
            BlockerRow(blocker: blocker, status: status)
        }
    }
}

private struct BlockerRow: View {
    let blocker: BlockerID
    @ObservedObject var status: BlockerStatusModel
    @State private var softEnabled: Bool = true

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: blocker.symbolName)
                .frame(width: 28)
                .foregroundStyle(iconColor)

            VStack(alignment: .leading, spacing: 2) {
                Text(blocker.title)
                Text(detailText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Toggle("", isOn: $softEnabled)
                .labelsHidden()
                .disabled(state != .enabled)
                .onChange(of: softEnabled) { on in
                    guard SharedStore.isEnabled(category: blocker.category) != on else { return }
                    Task { await status.setCategoryEnabled(on, blocker) }
                }
        }
        .onAppear { softEnabled = SharedStore.isEnabled(category: blocker.category) }
    }

    private var state: BlockerStatusModel.State {
        status.states[blocker] ?? .unknown
    }

    private var iconColor: Color {
        switch state {
        case .enabled: return softEnabled ? .green : .orange
        case .disabled: return .secondary
        case .unknown: return .secondary
        case .error: return .red
        }
    }

    private var detailText: String {
        switch state {
        case .unknown: return "Checking…"
        case .disabled: return "Off — enable in Settings → Apps → Safari → Extensions"
        case .enabled: return softEnabled ? blocker.subtitle : "Paused in app"
        case .error(let message): return "Error: \(message)"
        }
    }
}
