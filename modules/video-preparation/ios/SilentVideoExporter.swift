import AVFoundation
import Foundation

// Shared by the Expo bridge and the native fixture test. Copy encoded video
// samples, never audio; no quality loss or 30-minute re-encode is required.
final class SilentVideoExporter {
  private let lock = NSLock()
  private var sessions: [String: AVAssetExportSession] = [:]
  private var cancelled = Set<String>()

  static func localURL(_ uri: String) throws -> URL {
    guard let url = URL(string: uri), url.isFileURL else {
      throw failure("Choose a video stored on this device.")
    }
    return url
  }

  static func failure(_ message: String) -> NSError {
    NSError(domain: "VideoPreparation", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  static func inspect(_ uri: String) async throws -> [String: Any] {
    let asset = AVURLAsset(url: try localURL(uri))
    let duration = try await asset.load(.duration).seconds
    let video = try await asset.loadTracks(withMediaType: .video)
    let audio = try await asset.loadTracks(withMediaType: .audio)
    return ["duration": duration, "videoTracks": video.count, "audioTracks": audio.count]
  }

  func cancel(_ output: String) {
    lock.lock()
    cancelled.insert(output)
    let session = sessions[output]
    lock.unlock()
    session?.cancelExport()
  }

  private func start(_ session: AVAssetExportSession, key: String, completion: @escaping () -> Void) throws {
    lock.lock()
    defer { lock.unlock() }
    if cancelled.contains(key) { throw Self.failure("Video preparation cancelled.") }
    sessions[key] = session
    // Start under the same lock as cancellation so an early cancel cannot be lost.
    session.exportAsynchronously(completionHandler: completion)
  }

  private func finish(_ key: String) {
    lock.lock()
    sessions.removeValue(forKey: key)
    cancelled.remove(key)
    lock.unlock()
  }

  func stripAudio(_ uri: String, output: String) async throws {
    let destination = try Self.localURL(output)
    // Never overwrite an existing file, especially the original evidence.
    guard !FileManager.default.fileExists(atPath: destination.path) else {
      throw Self.failure("The output file already exists.")
    }
    defer { finish(output) }
    do {
      let asset = AVURLAsset(url: try Self.localURL(uri))
      let tracks = try await asset.loadTracks(withMediaType: .video)
      guard !tracks.isEmpty else { throw Self.failure("This file has no playable video.") }
      let composition = AVMutableComposition()
      for source in tracks {
        guard let track = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
          throw Self.failure("Could not prepare this video.")
        }
        let range = try await source.load(.timeRange)
        try track.insertTimeRange(range, of: source, at: range.start)
        track.preferredTransform = try await source.load(.preferredTransform)
      }
      guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough),
            session.supportedFileTypes.contains(.mov) else {
        throw Self.failure("This video format cannot be sent without audio. Choose an MP4 or MOV video.")
      }
      session.outputURL = destination
      session.outputFileType = .mov
      session.shouldOptimizeForNetworkUse = true
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        do {
          try start(session, key: output) { continuation.resume() }
        } catch { continuation.resume(throwing: error) }
      }
      guard session.status == .completed else {
        throw session.error ?? Self.failure("Audio removal did not finish. Nothing was uploaded.")
      }
    } catch {
      try? FileManager.default.removeItem(at: destination)
      throw error
    }
  }
}
