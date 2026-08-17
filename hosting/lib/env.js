// Dependency-free .env loader for the hosting scripts.
//
// Reads hosting/.env (if present) into a plain object and exposes a
// small getEnv() helper. We deliberately avoid pulling in `dotenv` so this
// library has zero npm dependencies and can be run with a bare `node` — see
// hosting/README.md.

const fs = require('fs');
const path = require('path');

let cached = null;

// Parse KEY=VALUE lines. Ignores blank lines and `#` comments, trims
// whitespace, and strips a single layer of matching single/double quotes.
function parseEnvFile(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

// Load the .env file once. Real process.env always wins over the file so the
// user can override any value inline (e.g. `CPANEL_HOST=... node list-dns.js`).
function loadEnv() {
  if (cached) return cached;
  const envPath = path.join(__dirname, '..', '.env');
  let fileVars = {};
  if (fs.existsSync(envPath)) {
    fileVars = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  }
  cached = { ...fileVars, ...process.env };
  return cached;
}

// Fetch a single variable. Throws a clear, actionable error when a required
// variable is missing rather than sending an empty credential to an API.
function getEnv(name, { required = true } = {}) {
  const env = loadEnv();
  const value = env[name];
  if ((value === undefined || value === '') && required) {
    throw new Error(
      `Missing required env var ${name}. Copy hosting/.env.example to ` +
        `hosting/.env and fill it in (see hosting/README.md).`
    );
  }
  return value;
}

module.exports = { loadEnv, getEnv };
