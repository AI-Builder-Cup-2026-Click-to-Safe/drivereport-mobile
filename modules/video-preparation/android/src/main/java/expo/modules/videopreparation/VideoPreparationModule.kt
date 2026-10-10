package expo.modules.videopreparation

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

class VideoPreparationModule : Module() {
  private val worker = Executors.newSingleThreadExecutor()
  private val cancelled = ConcurrentHashMap.newKeySet<String>()

  override fun definition() = ModuleDefinition {
    Name("VideoPreparation")
    AsyncFunction("inspectAsync") { uri: String, promise: Promise ->
      worker.execute {
        try { promise.resolve(inspect(uri)) }
        catch (e: Exception) { promise.reject("ERR_VIDEO_INSPECT", e.message, e) }
      }
    }
    AsyncFunction("stripAudioAsync") { uri: String, output: String, promise: Promise ->
      worker.execute {
        try { stripAudio(uri, output); promise.resolve(null) }
        catch (e: Exception) { promise.reject("ERR_VIDEO_PREPARATION", e.message, e) }
        finally { cancelled.remove(output) }
      }
    }
    Function("cancel") { output: String -> cancelled.add(output); Unit }
    OnDestroy { worker.shutdownNow() }
  }

  private fun localFile(uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Choose a video stored on this device." }
    return File(requireNotNull(parsed.path))
  }

  private fun inspect(uri: String): Map<String, Any> {
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(localFile(uri).path)
      var videos = 0
      var audios = 0
      var duration = 0L
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
        if (mime.startsWith("video/")) videos++
        if (mime.startsWith("audio/")) audios++
        if (format.containsKey(MediaFormat.KEY_DURATION))
          duration = maxOf(duration, format.getLong(MediaFormat.KEY_DURATION))
      }
      return mapOf("duration" to duration / 1_000_000.0, "videoTracks" to videos, "audioTracks" to audios)
    } finally { extractor.release() }
  }

  private fun stripAudio(uri: String, output: String) {
    val source = localFile(uri)
    val destination = localFile(output)
    require(!destination.exists()) { "The output file already exists." }
    val extractor = MediaExtractor()
    var muxer: MediaMuxer? = null
    var complete = false
    try {
      extractor.setDataSource(source.path)
      val writer = MediaMuxer(destination.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = writer
      val tracks = mutableMapOf<Int, Int>()
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        if (format.getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) {
          tracks[index] = writer.addTrack(format)
          extractor.selectTrack(index)
        }
      }
      require(tracks.isNotEmpty()) { "This file has no playable video." }
      val metadata = MediaMetadataRetriever()
      try {
        metadata.setDataSource(source.path)
        metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull()?.let {
          if (it in listOf(0, 90, 180, 270)) writer.setOrientationHint(it)
        }
      } finally { metadata.release() }
      writer.start()
      var buffer = ByteBuffer.allocateDirect(1024 * 1024)
      val info = MediaCodec.BufferInfo()
      while (extractor.sampleTrackIndex >= 0) {
        check(!cancelled.contains(output) && !Thread.currentThread().isInterrupted) { "Video preparation cancelled." }
        val size = extractor.sampleSize
        require(size in 1..(64L * 1024 * 1024)) { "This video contains an unsupported frame." }
        if (size > buffer.capacity()) buffer = ByteBuffer.allocateDirect(size.toInt())
        buffer.clear()
        val count = extractor.readSampleData(buffer, 0)
        if (count < 0) break
        require(extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_ENCRYPTED == 0) { "Protected videos cannot be uploaded." }
        val flags = if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
        info.set(0, count, extractor.sampleTime, flags)
        writer.writeSampleData(tracks.getValue(extractor.sampleTrackIndex), buffer, info)
        extractor.advance()
      }
      writer.stop()
      complete = true
    } finally {
      extractor.release()
      try { muxer?.release() } finally { if (!complete) destination.delete() }
    }
  }
}
