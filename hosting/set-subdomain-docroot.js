#!/usr/bin/env node
// WRITE ACTION. Changes the document root of an existing cPanel subdomain by
// deleting and immediately re-creating it with the new root.
//
// cPanel UAPI has no SubDomain::modifysubdomain on this plan, so the only
// programmatic path is delete + re-create. The source directory is never
// touched — only the Apache vhost configuration changes.
//
// Usage:
//   node hosting/set-subdomain-docroot.js <subdomain> <new-dir> [--domain=axispoint.llc] [--yes]
//
// <new-dir> is relative to the account home directory, e.g.:
//   node hosting/set-subdomain-docroot.js qr qr.axispoint.llc --yes

const { uapi, api2 } = require('./lib/cpanel');
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
  return { subdomain: positionals[0], newDir: positionals[1], rootdomain };
}

async function getCurrentDocroot(subdomain) {
  // API 2 is the only way to list subdomains (no UAPI equivalent).
  const res = await api2('SubDomain', 'listsubdomains');
  const rows = res.cpanelresult.data || [];
  const match = rows.find((r) => r.subdomain === subdomain);
  return match ? match.dir : null;
}

async function main() {
  const { subdomain, newDir, rootdomain } = parseArgs(process.argv);

  if (!subdomain || !newDir) {
    console.error(
      'Usage: node hosting/set-subdomain-docroot.js <subdomain> <new-dir> [--domain=axispoint.llc] [--yes]'
    );
    process.exit(1);
  }

  const fullDomain = `${subdomain}.${rootdomain}`;

  // 1. Confirm current state before touching anything.
  console.log('Checking current configuration ...');
  const currentDocroot = await getCurrentDocroot(subdomain);
  if (currentDocroot === null) {
    console.error(`ERROR: subdomain "${subdomain}" not found in cPanel. Verify name and try again.`);
    process.exit(1);
  }

  console.log('');
  console.log('Current configuration:');
  console.log(`  Subdomain:    ${fullDomain}`);
  console.log(`  Document root: ${currentDocroot}`);
  console.log('');
  console.log('Proposed change:');
  console.log(`  Document root: ${currentDocroot}`);
  console.log(`            → ${newDir}  (relative to home dir)`);
  console.log('');
  console.log('Method: delete subdomain config + re-create with new root.');
  console.log('Files on disk are NOT touched. Only the Apache vhost config changes.');
  console.log('');

  if (!(await confirm(`Update ${fullDomain} document root?`))) {
    console.log('Aborted. Nothing was changed.');
    process.exit(0);
  }

  // 2. Delete the existing subdomain config.
  // UAPI SubDomain::delsubdomain is unavailable on this Namecheap plan; API 2 works.
  // The directory on disk is NOT touched — only the Apache vhost config is removed.
  console.log(`\nDeleting ${fullDomain} vhost config (API 2) ...`);
  const delRes = await api2('SubDomain', 'delsubdomain', {
    domain: `${subdomain}.${rootdomain}`,
  });
  if (delRes.cpanelresult.data && delRes.cpanelresult.data[0] && delRes.cpanelresult.data[0].result === 0) {
    throw new Error(`delsubdomain failed: ${delRes.cpanelresult.data[0].reason || 'unknown'}`);
  }
  console.log('Deleted.');

  // 3. Re-create with the new document root.
  console.log(`Re-creating ${fullDomain} → ${newDir} ...`);
  await uapi('SubDomain', 'addsubdomain', {
    domain: subdomain,
    rootdomain,
    dir: newDir,
  });
  console.log('Created.');

  // 4. Verify the change took effect.
  console.log('\nVerifying ...');
  const updatedDocroot = await getCurrentDocroot(subdomain);

  if (!updatedDocroot) {
    console.error(`ERROR: ${fullDomain} is no longer listed after re-creation. Check cPanel.`);
    process.exit(1);
  }

  console.log('');
  console.log('CHANGE CONFIRMED');
  console.log('─'.repeat(60));
  console.log(`  Subdomain:     ${fullDomain}`);
  console.log(`  Document root: ${updatedDocroot}`);
  console.log('─'.repeat(60));

  if (!updatedDocroot.includes(newDir)) {
    console.error(
      `\nWARNING: document root "${updatedDocroot}" does not contain "${newDir}". ` +
        'Verify in cPanel File Manager.'
    );
    process.exit(1);
  }

  console.log('\nDocument root updated successfully.');
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
