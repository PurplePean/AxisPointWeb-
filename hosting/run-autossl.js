#!/usr/bin/env node
// WRITE ACTION. Asks cPanel to start an AutoSSL check now, via UAPI SSL::start_autossl_check.
// Requires explicit confirmation (--yes flag, or type "yes" at the prompt).
//
// AutoSSL already runs on its own schedule, so this is only to avoid waiting after a new
// subdomain is created. It does not issue a certificate for a domain whose DNS does not yet
// resolve to this server: the check will simply skip it, so run it after the A record is live.
//
// Usage:
//   node hosting/run-autossl.js [--verify=<hostname>] [--yes]
//
// With --verify, waits up to ~5 minutes after the check starts, polling the hostname over
// TLS, and reports whether it now presents a valid certificate.
//
// Examples:
//   node hosting/run-autossl.js
//   node hosting/run-autossl.js --verify=leasing.axispoint.llc --yes

const tls = require('tls');
const { uapi } = require('./lib/cpanel');
const { confirm } = require('./lib/confirm');

function parseArgs(argv) {
  let verify;
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--verify=')) verify = arg.slice('--verify='.length);
  }
  return { verify };
}

// Resolves with { valid, detail }. `valid` is true only when the TLS handshake succeeds with
// full certificate verification (rejectUnauthorized stays true).
function checkCertificate(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: true },
      () => {
        const cert = socket.getPeerCertificate();
        const detail = cert && cert.valid_to ? `valid until ${cert.valid_to}` : 'valid';
        socket.end();
        resolve({ valid: true, detail });
      }
    );
    socket.setTimeout(10000, () => {
      socket.destroy();
      resolve({ valid: false, detail: 'timed out' });
    });
    socket.on('error', (err) => resolve({ valid: false, detail: err.message }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { verify } = parseArgs(process.argv);

  console.log('About to START an AutoSSL check for this cPanel account.');
  console.log('  Issues or renews certificates only for domains that already resolve here.');
  console.log(`  Verify afterwards: ${verify || '(not requested)'}`);
  console.log('');

  if (!(await confirm('Start AutoSSL check?'))) {
    console.log('Aborted. Nothing was started.');
    process.exit(0);
  }

  const res = await uapi('SSL', 'start_autossl_check');
  const messages = Array.isArray(res.messages) ? res.messages.join('; ') : res.messages;
  console.log(`\nAutoSSL check requested.${messages ? ` ${messages}` : ''}`);

  if (!verify) return;

  console.log(`\nPolling https://${verify} (up to 10 tries, 30s apart)...`);
  for (let i = 1; i <= 10; i++) {
    await sleep(30000);
    const { valid, detail } = await checkCertificate(verify);
    console.log(`  try ${i}: ${valid ? 'VALID' : 'not yet'} (${detail})`);
    if (valid) return;
  }
  console.log('\nNo valid certificate yet. Confirm the DNS A record resolves to the server, then re-run.');
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
