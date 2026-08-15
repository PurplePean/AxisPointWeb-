# Archive: V1 Apps Script deployment record

_Created 2026-08-15, during the no-deletion verification and documentation safety pass._

## Why this file exists

[`docs/deployment.md`](../deployment.md) still holds the V1 Apps Script operating
instructions mixed in with V2 and hosting material. A later pass will edit those V1-only
instructions down. This record is written **before** that happens, so that the shape of the
V1 deployment survives in the current working tree and not only in git history that nobody
reads by accident.

This is a summary and a set of pointers. It is deliberately **not** a second copy of the
values.

## Where the full historical state actually lives

| Anchor | Commit | What it preserves |
|---|---|---|
| `v1-stable` | `c237a09` | The historical final V1 repository state |
| `pre-v1-retirement-2026-08-14` | `8a6aef1` | The complete pre-deletion repository state, identical to `main` as of this pass |
| `pre-v2-clean-rebuild` | `d194e7e` | The baseline immediately before the clean V2 rebuild, retained for context |

All three tags are present on `origin`. To read the V1 deployment documentation exactly as it
stood before any retirement edit:

```bash
git show pre-v1-retirement-2026-08-14:docs/deployment.md
git show v1-stable:scripts/gas/Code.gs
```

## What is deliberately NOT reproduced here

Per [`system-classification.md`](../system-classification.md), the following are external
systems or ignored files, not repository content, and they are not copied into this record:

- The V1 Apps Script **Script ID**, which lives in the gitignored `scripts/gas/.clasp.json`
- The V1 **Deployment ID** and the live `/exec` URL that embeds it
- The bound **Spreadsheet ID**
- The `FORM_ENDPOINT` GitHub secret value, or any FTP credential
- Any Script Property value

Those values are still written out in the current `docs/deployment.md` and in every tagged
commit above. Nothing here removes them; this record simply does not multiply the places
they appear. Retrieving one is a deliberate act against the tags or the Apps Script project,
not a lookup in an archive summary.

## The V1 deployment shape, in prose

**One Apps Script project, one Web App deployment.** `scripts/gas/Code.gs` plus
`appsscript.json` and the `emails/**` mirrors were pushed to a single Apps Script project.
The project was bound to one Google Sheet and deployed as a Web App with **Execute as: Me**
and **Access: Anyone (anonymous)**. The last recorded production version was **@28**.

**Push and deploy were always two separate operations.** `clasp push` (wrapped as
`pnpm gas:push`) updated the project HEAD, which is what the script editor shows and what
installed triggers execute. It did **not** change what the live `/exec` URL served. The live
URL was pinned to a specific deployed version, and `clasp deploy -i <deployment-id>` was the
step that actually released. Re-using the deployment ID kept the same `/exec` URL; creating a
new deployment would have minted a new URL and required updating both the `SCRIPT_URL` Script
Property and the `FORM_ENDPOINT` GitHub secret. Neither command was ever part of the
definition of "done" for a backend task.

**`.claspignore` was an allowlist, and it was load-bearing.** Only `appsscript.json`,
`Code.gs`, and `emails/**` were pushable. `.clasp.json` set `skipSubdirectories: false` and
listed `.js` in `scriptExtensions`, so without the allowlist clasp would have swept up every
`.js` under `scripts/gas/`, including the Node test suite. Apps Script runs every pushed
file's top-level statements in one shared global scope on every invocation, and those tests
open with `require('node:test')`, which Apps Script has no such thing as. Pushing them would
have thrown on every `doPost` and every trigger: a full backend outage caused entirely by
files that were not `Code.gs`. `scripts/gas-v2/.claspignore` follows the same rule and is
asserted by a test rather than trusted.

**Email templates existed in two copies.** The standalone HTML files under
`scripts/gas/emails/` were a source-of-truth mirror; Apps Script rendered the embedded
`TEMPLATE_*` string constants inside `Code.gs`. Editing one copy without the other silently
broke production, and the V1 test suite enforced parity between them. This duplication was
deliberately **not** carried forward into `scripts/gas-v2`, which has exactly one copy of
each template as a pure function in `src/Templates.js`.

**The deploying account needed edit access to the bookings calendar.** The Web App ran as
`executeAs: USER_DEPLOYING`, so every `Calendar.Events.insert` and `Calendar.Freebusy.query`
executed as the account that created the deployment. Read-level sharing was not sufficient:
free/busy reads would succeed while every event insert failed, which presented as bookings
that produced a confirmation email and no calendar event. This mattered the moment the
deploying account changed, because a redeploy from a different Google account silently
re-binds execution identity.

**`clasp` reauth friction was routine.** `clasp push`, `clasp deploy`, and other subcommands
each independently triggered `invalid_grant` / `invalid_rapt` OAuth errors, repeatedly within
one session even right after a successful `clasp login`. That was Google reauth behaviour,
never evidence of a broken `Code.gs`.

**One-time setup, for the record.** Create the Sheet and the Apps Script project, set the
project time zone to `America/Chicago`, create the shared bookings calendar and grant the
deploying account edit access, run `setProperties()` once, run `setupSpreadsheet()` to create
the tabs, enable the advanced Calendar API v3 service, deploy as a Web App, then run
`setupTriggers()` for the daily digest, weekly cold-lead sweep, monthly summary, and onEdit
sync.

## Current status of V1

Per [`system-classification.md`](../system-classification.md): V1 is **permanently retired as
a business system** and the tracked backend under `scripts/gas` is **not serving current
business traffic**. The website visible at the public domain is a separate, hand-uploaded
build that was not produced from this repository.

The Apps Script project itself is an external system. It is not deleted, altered, or
otherwise touched by any repository change, including the deletion pass that will follow
this one. Whether that external project is left in place, disabled, or removed is a separate
owner decision and a separate authorized operation.

## What this record does not authorize

Nothing here is a deployment instruction for anything current. It is history. The V2 backend
is provisioned by the checklist in [`deployment.md`](../deployment.md), and no step of it is
performed by a merge.
