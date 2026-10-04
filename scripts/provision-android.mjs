import { execFileSync } from "node:child_process";
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
execFileSync(
  "adb",
  [
    "shell",
    "run-as",
    "com.example.safetycar.dev",
    "sh",
    "-c",
    "'umask 077; cat > files/connection.local.json'",
  ],
  {
    input: JSON.stringify({
      apiUrl: "https://prototype-video-api-fydsujlsyq-uc.a.run.app",
      token,
    }),
    stdio: ["pipe", "ignore", "pipe"],
  },
);
console.log(
  "Development device connection provisioned. Reload DriveReport to move it to SecureStore.",
);
