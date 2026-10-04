const { withAndroidManifest } = require("expo/config-plugins");
module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries || [];
    if (
      !manifest.queries.some((q) =>
        q.package?.some((p) => p.$?.["android:name"] === "com.whatsapp"),
      )
    ) {
      manifest.queries.push({
        package: [
          { $: { "android:name": "com.whatsapp" } },
          { $: { "android:name": "com.whatsapp.w4b" } },
        ],
      });
    }
    return config;
  });
