const { WarningAggregator, withPodfile } = require("expo/config-plugins");

// Xcode 27 only builds iOS 15.0+ targets. Some pods still declare older ones
// (RNSVG's RNSVGFilters and AsyncStorage's resource bundle use 12.4 / 13.4),
// so raise any pod below the app's own minimum after CocoaPods generates them.
const marker = "# click-to-safe: raise pod deployment targets";
const snippet = `
    ${marker}
    minimum_ios = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |build_configuration|
        current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new(minimum_ios)
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios
        end
      end
    end`;
const postInstallCall = /react_native_post_install\([\s\S]*?\n\s*\)/;

function addPodDeploymentTarget(podfile) {
  if (podfile.includes(marker) || !postInstallCall.test(podfile)) return podfile;
  return podfile.replace(postInstallCall, (call) => call + snippet);
}

const withPodDeploymentTarget = (config) =>
  withPodfile(config, (config) => {
    const podfile = config.modResults.contents;
    if (!podfile.includes(marker) && !postInstallCall.test(podfile))
      WarningAggregator.addWarningIOS(
        "withPodDeploymentTarget",
        "react_native_post_install was not found in the Podfile; pod deployment targets were not raised.",
      );
    config.modResults.contents = addPodDeploymentTarget(podfile);
    return config;
  });

module.exports = withPodDeploymentTarget;
module.exports.addPodDeploymentTarget = addPodDeploymentTarget;
