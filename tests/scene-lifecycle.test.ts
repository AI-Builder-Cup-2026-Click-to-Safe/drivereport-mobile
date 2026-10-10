import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { addSceneDelegate } = require("../plugins/withSceneLifecycle.js");

const appDelegate = `public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

test("the window moves from launch into a scene delegate", () => {
  const patched = addSceneDelegate(appDelegate);
  assert.doesNotMatch(patched, /UIWindow\(frame: UIScreen\.main\.bounds\)/);
  assert.match(patched, /class SceneDelegate: UIResponder, UIWindowSceneDelegate/);
  assert.match(patched, /UIWindow\(windowScene: windowScene\)/);
  assert.equal(patched.match(/startReactNative\(/g)?.length, 1);
});

test("a cold-start link reaches the app delegate before React Native starts", () => {
  const patched = addSceneDelegate(appDelegate);
  const forward = patched.indexOf(
    "appDelegate.application(UIApplication.shared, open: url",
  );
  assert.ok(forward > 0);
  assert.ok(forward < patched.indexOf("startReactNative("));
});

test("the AppDelegate patch is applied once", () => {
  const once = addSceneDelegate(appDelegate);
  assert.equal(addSceneDelegate(once), once);
});

test("an unfamiliar AppDelegate is left unchanged", () => {
  const other = "class AppDelegate {}\n";
  assert.equal(addSceneDelegate(other), other);
});
