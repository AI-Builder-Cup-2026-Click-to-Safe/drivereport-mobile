import ExpoModulesCore

public class VideoPreparationModule: Module {
  private let exporter = SilentVideoExporter()

  public func definition() -> ModuleDefinition {
    Name("VideoPreparation")
    AsyncFunction("inspectAsync") { (uri: String) async throws -> [String: Any] in
      try await SilentVideoExporter.inspect(uri)
    }
    AsyncFunction("stripAudioAsync") { (uri: String, output: String) async throws in
      try await self.exporter.stripAudio(uri, output: output)
    }
    Function("cancel") { (output: String) in self.exporter.cancel(output) }
  }
}
