import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const bundled of [false, true]) {
  test(`restored connection ${bundled ? "uses the judging credential and its server" : "preserves manual settings"}`, () => {
    const domain = new URL("../src/lib/domain.ts", import.meta.url).href;
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';
      import { initialSettings, applyBuildConnection, DEFAULT_API } from ${JSON.stringify(domain)};
      const saved = { ...initialSettings, apiUrl: 'https://another-server.example', token: '', name: 'Tester' };
      const restored = applyBuildConnection(saved);
      assert.equal(restored.apiUrl, ${bundled} ? DEFAULT_API : saved.apiUrl);
      assert.equal(restored.token, ${bundled} ? 'test-only-fixture' : '');
      assert.equal(restored.name, 'Tester');
      assert.equal(applyBuildConnection({ ...saved, token: 'older-token' }).token, ${bundled} ? 'test-only-fixture' : 'older-token');
    `,
      ],
      {
        env: {
          ...process.env,
          EXPO_PUBLIC_JUDGING_API_TOKEN: bundled ? "test-only-fixture" : "",
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
  });
}
