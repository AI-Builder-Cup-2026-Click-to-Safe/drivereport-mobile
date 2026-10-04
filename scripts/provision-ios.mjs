// Install the existing GCP secret into the simulator's private app container.
// The app moves it to SecureStore and removes the file on its next launch.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const device = process.argv[2] || "booted";
const container = execFileSync(
  "xcrun",
  ["simctl", "get_app_container", device, "com.example.safetycar.dev", "data"],
  { encoding: "utf8" },
).trim();
const token = execFileSync(
  "gcloud",
  [
    "secrets",
    "versions",
    "access",
    "latest",
    "--secret=prototype-public-api-token",
    "--project=aitech-good-s27493",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
).trim();
if (!token) throw new Error("The GCP secret is empty.");
writeFileSync(
  join(container, "Documents", "connection.local.json"),
  JSON.stringify({
    apiUrl: "https://prototype-video-api-fydsujlsyq-uc.a.run.app",
    token,
  }),
  { mode: 0o600 },
);
console.log(
  "Simulator connection provisioned. Reload DriveReport to import it into SecureStore. No token was printed or bundled.",
);
