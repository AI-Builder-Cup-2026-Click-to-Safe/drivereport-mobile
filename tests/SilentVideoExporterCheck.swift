import AVFoundation
import Foundation

@main struct SilentVideoExporterCheck {
  static func main() async throws {
    guard CommandLine.arguments.count == 3 else {
      fatalError("Usage: native-video-check input-video output.mov")
    }
    let source = URL(fileURLWithPath: CommandLine.arguments[1]).absoluteString
    let output = URL(fileURLWithPath: CommandLine.arguments[2]).absoluteString
    let before = try await SilentVideoExporter.inspect(source)
    let exporter = SilentVideoExporter()
    try await exporter.stripAudio(source, output: output)
    let after = try await SilentVideoExporter.inspect(output)
    guard before["audioTracks"] as? Int ?? 0 > 0,
          after["audioTracks"] as? Int == 0,
          after["videoTracks"] as? Int == before["videoTracks"] as? Int,
          let beforeDuration = before["duration"] as? Double,
          let afterDuration = after["duration"] as? Double,
          abs(beforeDuration - afterDuration) <= 0.25 else {
      fatalError("Audio removal/duration check failed: \(before) -> \(after)")
    }
    // Cancelling before the native worker starts must not produce a file.
    let cancelled = output.replacingOccurrences(of: ".mov", with: "-cancelled.mov")
    exporter.cancel(cancelled)
    do {
      try await exporter.stripAudio(source, output: cancelled)
      fatalError("Cancelled export succeeded")
    } catch {
      assert(!FileManager.default.fileExists(atPath: URL(string: cancelled)!.path))
    }
    // The original and an existing destination must never be overwritten.
    do {
      try await exporter.stripAudio(source, output: source)
      fatalError("Original was overwritten")
    } catch { }
    print("PASS: \(before) -> \(after); cancellation and original preservation checked")
  }
}
