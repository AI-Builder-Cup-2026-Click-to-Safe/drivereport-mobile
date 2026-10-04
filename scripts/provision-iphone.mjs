// Provision only this development app's sandbox on a USB-connected iPhone.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const udid = process.argv[2];
if (!udid) throw new Error('Usage: node scripts/provision-iphone.mjs <iPhone UDID>');
const { expo } = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const token = execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=prototype-public-api-token', '--project=aitech-good-s27493'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
if (!token) throw new Error('The GCP secret is empty.');
const directory = mkdtempSync(join(tmpdir(), 'drivereport-provision-'));
try {
  const path = join(directory, 'connection.local.json');
  writeFileSync(path, JSON.stringify({ apiUrl: 'https://prototype-video-api-fydsujlsyq-uc.a.run.app', token }), { mode: 0o600 });
  execFileSync('afcclient', ['--udid', udid, '--container', expo.ios.bundleIdentifier, 'put', path, 'Documents/connection.local.json'], { stdio: ['ignore', 'ignore', 'pipe'] });
  console.log('Connection copied into the development app sandbox. Launch or reload DriveReport to move it to SecureStore. No token was printed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
