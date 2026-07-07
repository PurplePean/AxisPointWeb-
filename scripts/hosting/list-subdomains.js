#!/usr/bin/env node
// READ-ONLY. Lists this cPanel account's subdomains and their document roots.
//
// This is the first script to run: it verifies real cPanel access (host, token,
// TLS on :2083) before any write script is trusted.
//
// Usage:
//   node scripts/hosting/list-subdomains.js

const { uapi } = require('./lib/cpanel');
const { printTable } = require('./lib/table');

async function main() {
  const res = await uapi('SubDomain', 'listsubdomains');
  const rows = Array.isArray(res.data) ? res.data : [];

  console.log(`Found ${rows.length} subdomain(s):\n`);
  printTable(
    rows.map((r) => ({
      subdomain: r.subdomain || r.domain,
      domain: r.domain,
      documentRoot: r.dir || r.documentroot || r.reldir,
      status: r.status,
    })),
    [
      { key: 'subdomain', label: 'SUBDOMAIN' },
      { key: 'domain', label: 'FULL DOMAIN' },
      { key: 'documentRoot', label: 'DOCUMENT ROOT' },
      { key: 'status', label: 'STATUS' },
    ]
  );
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
