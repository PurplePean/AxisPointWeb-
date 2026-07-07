#!/usr/bin/env node
// WRITE ACTION. Creates a subdomain via cPanel UAPI SubDomain::addsubdomain.
// Requires explicit confirmation (--yes flag, or type "yes" at the prompt).
//
// Usage:
//   node scripts/hosting/add-subdomain.js <subdomain> [document-root] [--domain=axispoint.llc] [--yes]
//
// Examples:
//   node scripts/hosting/add-subdomain.js book
//   node scripts/hosting/add-subdomain.js book public_html/book --yes
//   node scripts/hosting/add-subdomain.js promo --domain=example.com

const { uapi } = require('./lib/cpanel');
const { confirm } = require('./lib/confirm');

function parseArgs(argv) {
  const positionals = [];
  let rootdomain = 'axispoint.llc';
  for (const arg of argv.slice(2)) {
    if (arg === '--yes' || arg === '-y') continue;
    if (arg.startsWith('--domain=')) {
      rootdomain = arg.slice('--domain='.length);
      continue;
    }
    if (arg.startsWith('-')) continue;
    positionals.push(arg);
  }
  return { subdomain: positionals[0], dir: positionals[1], rootdomain };
}

async function main() {
  const { subdomain, dir, rootdomain } = parseArgs(process.argv);

  if (!subdomain) {
    console.error(
      'Usage: node scripts/hosting/add-subdomain.js <subdomain> [document-root] [--domain=axispoint.llc] [--yes]'
    );
    process.exit(1);
  }

  const fullDomain = `${subdomain}.${rootdomain}`;
  console.log('About to CREATE a subdomain:');
  console.log(`  Full domain:   ${fullDomain}`);
  console.log(`  Root domain:   ${rootdomain}`);
  console.log(`  Document root: ${dir || '(cPanel default)'}`);
  console.log('');

  if (!(await confirm(`Create ${fullDomain}?`))) {
    console.log('Aborted. Nothing was created.');
    process.exit(0);
  }

  const params = { domain: subdomain, rootdomain };
  if (dir) params.dir = dir;

  const res = await uapi('SubDomain', 'addsubdomain', params);
  const messages = Array.isArray(res.messages) ? res.messages.join('; ') : res.messages;
  console.log(`\nCreated ${fullDomain}.${messages ? ` ${messages}` : ''}`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
