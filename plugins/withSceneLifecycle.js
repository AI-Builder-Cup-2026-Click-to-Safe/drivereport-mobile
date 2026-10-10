const {
  WarningAggregator,
  withAppDelegate,
  withInfoPlist,
} = require("expo/config-plugins");

// iOS 27 refuses to launch an app built with the iOS 27 SDK unless it adopts
// the UIScene lifecycle. Expo SDK 54's AppDelegate still creates its window
// at launch, so create it in a scene delegate instead. UIScene exists since
// iOS 13, so builds made with older SDKs launch the same way.
const marker = "// click-to-safe: UIScene lifecycle";
const launchWindow =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
const sceneDelegate = `
${marker}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    // A link that cold-launches the app arrives here, not in launchOptions or open url.
    // Hand it to the app delegate first so expo-linking records it as the initial URL.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
      _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
    }
    if let userActivity = connectionOptions.userActivities.first {
      _ = appDelegate.application(
        UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  // Route links through the app delegate so Expo and React Native handle them as before.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

function addSceneDelegate(appDelegate) {
  if (appDelegate.includes(marker) || !launchWindow.test(appDelegate))
    return appDelegate;
  return (
    appDelegate.replace(
      launchWindow,
      "\n    // The window is created by SceneDelegate (UIScene lifecycle).\n",
    ) + sceneDelegate
  );
}

const sceneManifest = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: "Default Configuration",
        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
      },
    ],
  },
};

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = sceneManifest;
    return config;
  });
  return withAppDelegate(config, (config) => {
    const source = config.modResults.contents;
    const patchable =
      config.modResults.language === "swift" &&
      (source.includes(marker) || launchWindow.test(source));
    if (!patchable) {
      WarningAggregator.addWarningIOS(
        "withSceneLifecycle",
        "The AppDelegate did not match the Expo SDK 54 template; add a SceneDelegate by hand or the app will not launch on iOS 27.",
      );
      return config;
    }
    config.modResults.contents = addSceneDelegate(source);
    return config;
  });
};

module.exports = withSceneLifecycle;
module.exports.addSceneDelegate = addSceneDelegate;
