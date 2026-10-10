Pod::Spec.new do |s|
  s.name = 'VideoPreparation'
  s.version = '1.0.0'
  s.summary = 'Prepare audio-free evidence videos on device'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Click-to-Safe'
  s.homepage = 'https://github.com/AI-Builder-Cup-2026-Click-to-Safe/drivereport-mobile'
  s.source = { :git => s.homepage }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
