// Confirmation gate for write/destructive actions.
//
// A write only proceeds when the user has clearly opted in: either they passed
// `--yes` on the command line, or they type "yes" at the interactive prompt.
// Anything else aborts. This is intentionally strict — these scripts create
// subdomains, add redirects, and delete files on a live host.

const readline = require('readline');

// Returns true if argv contains the --yes / -y flag.
function hasYesFlag(argv = process.argv) {
  return argv.includes('--yes') || argv.includes('-y');
}

// Resolves to true only if the write should proceed.
async function confirm(question, argv = process.argv) {
  if (hasYesFlag(argv)) {
    console.log(`${question} --yes supplied, proceeding.`);
    return true;
  }

  // Non-interactive (piped) stdin can't answer a prompt: fail closed.
  if (!process.stdin.isTTY) {
    console.error(
      `${question}\nRefusing to proceed: no TTY to prompt on and --yes was not passed.`
    );
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`${question} Type "yes" to proceed: `, resolve);
  });
  rl.close();

  return answer.trim().toLowerCase() === 'yes';
}

module.exports = { confirm, hasYesFlag };
