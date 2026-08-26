#!/usr/bin/env node
// READ-WRITE. Triggers a full cPanel account backup to the home directory,
// then waits for it to complete and reports the archive name and size.
//
// This is step 0 of the production cutover: a complete, restorable copy of the
// entire hosting account (public_html plus mail, logs, etc.) before any files
// are changed. Do not proceed with cutover until this script exits with
// "BACKUP CONFIRMED" and a non-zero size.
//
// The backup is stored in the account home directory as:
//   ~/backup-M.DD.YYYY_HH-MM-SS_<username>.tar.gz
// It can be downloaded via cPanel File Manager or FTP from there.
//
// Usage:
//   node hosting/backup-public-html.js

const { uapi } = require('./lib/cpanel');
const { getEnv } = require('./lib/env');

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 300000; // 5 minutes

async function waitForBackup(username, startMs) {
  for (;;) {
    const elapsed = Date.now() - startMs;
    if (elapsed > MAX_WAIT_MS) {
      throw new Error(
        `Timed out after ${MAX_WAIT_MS / 1000}s waiting for backup to appear in home directory.`
      );
    }

    const listRes = await uapi('Fileman', 'list_files', { dir: '.', show_hidden: 0 });
    const entries = Array.isArray(listRes.data) ? listRes.data : [];

    // cPanel names full backups: backup-M.DD.YYYY_HH-MM-SS_<username>.tar.gz
    const backup = entries.find(
      (e) => e.file.startsWith('backup-') && e.file.endsWith(`_${username}.tar.gz`)
    );

    if (backup) return backup;

    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function main() {
  const username = getEnv('CPANEL_USERNAME');

  console.log('Triggering full account backup to home directory ...');
  console.log('');

  const startMs = Date.now();
  const triggerRes = await uapi('Backup', 'fullbackup_to_homedir', {});

  // Returns { pid } — backup runs in background on the server.
  const pid = triggerRes.data && triggerRes.data.pid;
  console.log(`Backup started (server PID: ${pid || 'unknown'}).`);
  console.log('Waiting for archive to appear in home directory (polling every 5s) ...');

  const backup = await waitForBackup(username, startMs);
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log('');
  console.log('');

  const sizeBytes = Number(backup.size);
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

  console.log('BACKUP CONFIRMED');
  console.log('─'.repeat(60));
  console.log(`  File:     ~/${backup.file}`);
  console.log(`  Full path: ${backup.fullpath}`);
  console.log(`  Size:     ${sizeBytes.toLocaleString()} bytes  (${sizeMB} MB)`);
  console.log(`  Elapsed:  ${elapsed}s`);
  console.log('─'.repeat(60));
  console.log('');
  console.log('This is a full account backup: public_html, mail, logs, config.');
  console.log('Download it from cPanel File Manager before proceeding with cutover.');
  console.log('');
  console.log('Step 0 (pre-cutover backup) is complete.');
  console.log('You may now proceed with the cutover sequence.');
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
