#!/usr/bin/env node
// WRITE ACTION. Creates a redirect via cPanel UAPI Redirects::add_redirect.
// Requires explicit confirmation (--yes flag, or type "yes" at the prompt).
//
// Usage:
//   node scripts/hosting/add-redirect.js <source-path> <destination-url> \
//        [--domain=axispoint.llc] [--type=permanent|temporary] [--wildcard] [--yes]
//
// Examples:
//   node scripts/hosting/add-redirect.js /old-page https://axispoint.llc/new-page
//   node scripts/hosting/add-redirect.js / https://qr.axispoint.llc --type=temporary --yes
//
// Notes on cPanel semantics:
//   - `src` is the path portion to match, e.g. "/old-page" (or "/" for the root).
//   - `type` maps to 301 (permanent) or 302 (temporary); default permanent.
//   - `redirect_with_or_without_www=2` makes the redirect fire with OR without
//     the www prefix (the most common, least-surprising choice).

const { uapi } = require('./lib/cpanel');
const { confirm } = require('./lib/confirm');

function parseArgs(argv) {
  const positionals = [];
  let domain = 'axispoint.llc';
  let type = 'permanent';
  let wildcard = false;
  for (const arg of argv.slice(2)) {
    if (arg === '--yes' || arg === '-y') continue;
    if (arg === '--wildcard') {
      wildcard = true;
      continue;
    }
    if (arg.startsWith('--domain=')) {
      domain = arg.slice('--domain='.length);
      continue;
    }
    if (arg.startsWith('--type=')) {
      type = arg.slice('--type='.length);
      continue;
    }
    if (arg.startsWith('-')) continue;
    positionals.push(arg);
  }
  return { src: positionals[0], destination: positionals[1], domain, type, wildcard };
}

async function main() {
  const { src, destination, domain, type, wildcard } = parseArgs(process.argv);

  if (!src || !destination) {
    console.error(
      'Usage: node scripts/hosting/add-redirect.js <source-path> <destination-url> ' +
        '[--domain=axispoint.llc] [--type=permanent|temporary] [--wildcard] [--yes]'
    );
    process.exit(1);
  }

  if (type !== 'permanent' && type !== 'temporary') {
    console.error(`--type must be "permanent" or "temporary", got "${type}"`);
    process.exit(1);
  }

  console.log('About to CREATE a redirect:');
  console.log(`  Domain:      ${domain}`);
  console.log(`  Source path: ${src}`);
  console.log(`  Destination: ${destination}`);
  console.log(`  Type:        ${type} (${type === 'permanent' ? '301' : '302'})`);
  console.log(`  Wildcard:    ${wildcard ? 'yes' : 'no'}`);
  console.log('');

  if (!(await confirm(`Create redirect ${src} -> ${destination}?`))) {
    console.log('Aborted. Nothing was created.');
    process.exit(0);
  }

  const params = {
    domain,
    src,
    redirect: destination,
    type,
    redirect_wildcard: wildcard ? 1 : 0,
    redirect_with_or_without_www: 2,
  };

  const res = await uapi('Redirects', 'add_redirect', params);
  const messages = Array.isArray(res.messages) ? res.messages.join('; ') : res.messages;
  console.log(`\nCreated redirect ${src} -> ${destination}.${messages ? ` ${messages}` : ''}`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
