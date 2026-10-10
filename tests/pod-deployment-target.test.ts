import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { addPodDeploymentTarget } = require("../plugins/withPodDeploymentTarget.js");

const podfile = `target 'ClicktoSafe' do
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
    )
  end
end
`;

test("pod deployment targets are raised after react_native_post_install", () => {
  const patched = addPodDeploymentTarget(podfile);
  const call = patched.indexOf("react_native_post_install(");
  const fix = patched.indexOf("installer.pods_project.targets.each");
  assert.ok(call >= 0 && fix > call);
  assert.ok(fix < patched.lastIndexOf("  end\nend"));
  assert.match(patched, /podfile_properties\['ios\.deploymentTarget'\] \|\| '15\.1'/);
});

test("the Podfile patch is applied once", () => {
  const once = addPodDeploymentTarget(podfile);
  assert.equal(addPodDeploymentTarget(once), once);
});

test("an unexpected Podfile is left unchanged", () => {
  const other = "target 'App' do\nend\n";
  assert.equal(addPodDeploymentTarget(other), other);
});
