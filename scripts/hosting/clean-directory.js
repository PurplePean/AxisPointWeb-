#!/usr/bin/env node
// WRITE / DESTRUCTIVE ACTION. Deletes the CONTENTS of a directory on the cPanel
// account. It ALWAYS lists what it found first and never deletes without
// explicit confirmation (--yes flag, or type "yes" at the prompt).
//
// Delete is done via cPanel API 2 Fileman::fileop with op=unlink — there is no
// UAPI equivalent for deleting files (see lib/cpanel.js). Listing uses UAPI
// Fileman::list_files.
//
// Usage:
//   node scripts/hosting/clean-directory.js <target-path> [--yes]
//
// Examples:
//   node scripts/hosting/clean-directory.js public_html/staging
//   node scripts/hosting/clean-directory.js public_html/old-deploy --yes
//
// <target-path> is interpreted by cPanel relative to the account home directory
// (e.g. "public_html/staging"), matching how the File Manager shows paths.

const { uapi, api2 } = require('./lib/cpanel');
const { printTable } = require('./lib/table');
const { confirm } = require('./lib/confirm');

async function main() {
  const target = process.argv.slice(2).find((a) => !a.startsWith('-'));

  if (!target) {
    console.error('Usage: node scripts/hosting/clean-directory.js <target-path> [--yes]');
    process.exit(1);
  }

  // 1. LIST first — always, before anything is touched.
  const res = await uapi('Fileman', 'list_files', { dir: target, show_hidden: 1 });
  const entries = Array.isArray(res.data) ? res.data : [];

  if (!entries.length) {
    console.log(`"${target}" is empty (or does not exist). Nothing to delete.`);
    process.exit(0);
  }

  console.log(`Contents of "${target}" (${entries.length} item(s)):\n`);
  printTable(
    entries.map((e) => ({
      name: e.file,
      type: e.type,
      size: e.size,
      modified: e.mtime,
    })),
    [
      { key: 'name', label: 'NAME' },
      { key: 'type', label: 'TYPE' },
      { key: 'size', label: 'SIZE' },
      { key: 'modified', label: 'MTIME' },
    ]
  );
  console.log('');

  // 2. Confirm before deleting anything.
  console.log(`This will DELETE all ${entries.length} item(s) listed above under "${target}".`);
  if (!(await confirm('Proceed with deletion?'))) {
    console.log('Aborted. Nothing was deleted.');
    process.exit(0);
  }

  // 3. Delete. sourcefiles is a comma-separated list of paths relative to home.
  const sourcefiles = entries.map((e) => `${target}/${e.file}`).join(',');
  await api2('Fileman', 'fileop', { op: 'unlink', sourcefiles });

  console.log(`\nDeleted ${entries.length} item(s) from "${target}".`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
