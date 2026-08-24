# scripts/gas-v2 — V2 Apps Script backend

The V2 backend, and the only backend in this repository. V1 was fully retired and deleted
on 2026-08-15. Its source is no longer reachable from `main` and is read from a tag
instead: `v1-stable` is the canonical one, and `pre-v1-retirement-2026-08-14` and
`pre-v2-clean-rebuild` each also contain the complete V1 backend and form tree.

**Nothing here is connected to anything.** There is no `.clasp.json`, no Apps Script
project, no Sheet, no trigger, and no deployment. Both frontends are wired to this
contract and build real request envelopes, but there is no endpoint for them to reach.
The code is written, tested, and reviewable; bringing it up is a separate, separately
authorized operation. See [`docs/deployment.md`](../../docs/deployment.md).

## What is here

```
.claspignore       allowlist: deny everything, re-allow appsscript.json and src/**/*.js
appsscript.json    manifest (V8, project time zone, OAuth scopes)
src/               the deployable source, one shared global scope
tests/             Node test suite; never pushed
tools/             local-only utilities; never pushed
audit/             local-only locale audit input; never pushed
```

### src, grouped

**The folders are a reading aid, not a module system.** Apps Script has no imports: it
concatenates every pushed file into ONE global scope, so `core/Domain.js` calls a function
declared in `shared/Util.js` by bare name, exactly as it did when both sat flat in `src/`.
Nothing in the layout changes evaluation order, which Apps Script still controls, so the
load-order rule below applies across folders exactly as it did within one.

| Folder | What belongs in it |
|---|---|
| `entrypoints/` | The functions Apps Script itself calls by name. |
| `core/` | Business rules. Plain JavaScript, no Google service, no email markup. |
| `platform/` | Configuration, ports, wiring, and the Google adapter. |
| `scheduled/` | Work driven by a trigger rather than by a request. |
| `emails/` | Rendering only. One pure function per message. |
| `shared/` | Pure helpers with no domain and no integration. |

| File | Responsibility |
|---|---|
| `core/Tokens.js` | The stable snake_case wire vocabulary for `schemaVersion` 1. |
| `emails/Labels.js` | Wire value to human label. No email ever prints a token. |
| `shared/Util.js` | Ids, ISO time, normalization, redaction. No Google service. |
| `platform/Config.js` | Script Property names, worker bounds, business hours, SLA targets. |
| `core/Contract.js` | Envelope parsing and validation. The boundary. |
| `core/Attribution.js` | Attribution flattening, partner-slug resolution, locale records. |
| `core/Domain.js` | Lead and Contact builders, merge rules, row projection. |
| `core/Records.js` | The immutable Submission and the mutable Delivery. |
| `emails/Html.js` | Email-safe HTML primitives and escaping. |
| `emails/EmailHelpers.js` | Firm identity, name and row helpers, human date formatting. |
| `emails/QrAcknowledgement.js` | To the person who shared details from a scanned card. |
| `emails/WebsiteAcknowledgement.js` | To the person who submitted a website inquiry. |
| `emails/InternalNotification.js` | To the partners, immediately, on a website inquiry. |
| `emails/QrDigestEmail.js` | The daily QR Contact digest, rendering only. |
| `emails/BookingConfirmation.js` | Sent only after Calendar confirmed the event exists. |
| `emails/Registry.js` | Locale sets, the per-renderer fallback rule, and the templates port. |
| `scheduled/Digest.js` | The daily QR Contact digest: eligibility, routing, splitting, delivery-bound state. |
| `scheduled/Retention.js` | Retention selection and the callable maintenance handler. |
| `core/Matching.js` | Identity suggestions. Suggests; never merges. |
| `core/Sla.js` | Business-hours due-time arithmetic. |
| `core/Spam.js` | Screening. Flags; never discards. |
| `core/Routing.js` | Who gets notified, and who provisionally owns the lead. |
| `scheduled/Worker.js` | The bounded at-least-once work-queue state machine. |
| `core/Notifications.js` | Acknowledgement and partner-notification handlers. |
| `core/Booking.js` | The post-submission booking command and its queued calendar write. |
| `core/Intake.js` | Submission orchestration: store, then queue, then return. |
| `platform/Ports.js` | Every outside-world interface, plus the not-configured stubs. |
| `platform/SheetRepository.js` | Sheet-backed repositories, resolved by header name. |
| `platform/GoogleServices.js` | The only file that calls a Google service. |
| `platform/Runtime.js` | Production wiring. |
| `entrypoints/Entry.js` | `doPost`, `doGet`, `runWorkerTrigger`, response shaping. |

## The rules this project is built on

**`.claspignore` is an allowlist, and that is load-bearing.** Apps Script evaluates
every pushed file's top-level statements in one shared global scope on every
invocation. A pushed Node test file opens with `require()`, which GAS has no
definition for, and from that moment every `doPost` and every trigger throws. That is
a full backend outage caused by files that are not source. So the file denies `**/**`
first and re-allows only `appsscript.json` and `src/**/*.js`. `tests/deployability.test.js`
asserts it stays that way.

**No file reads another file's value at load time.** Apps Script decides evaluation
order, not this repository, so a top-level `var X = SOME_CONSTANT_FROM_ANOTHER_FILE`
throws for every request if the order is not what the author assumed. Cross-file
values are read inside function bodies. A test loads `src` in reverse order to prove it.

**Google services live behind ports.** `platform/GoogleServices.js` is the only file that names
`SpreadsheetApp`, `MailApp`, `CalendarApp`, `Calendar` (the Advanced Calendar API, used for
`Calendar.Events.insert` with `conferenceDataVersion`), `LockService`, or `PropertiesService`
(`entrypoints/Entry.js` additionally uses `ContentService` to shape its response). Everything else
is plain JavaScript, which is why the suite runs the real decision code under Node
rather than a parallel reimplementation of it.

**No environment value is in this directory.** No project id, Sheet id, deployment id,
calendar id, endpoint, or address. Configuration is read from Script Properties by
name at call time, and a missing property fails closed with a stable code rather than
falling back to some other environment's resource.

**Storage happens before side effects.** The durable record is the only artifact that
cannot be reconstructed. Email and calendar work is queued and executed by a trigger,
so a mail quota failure costs a delayed notification, not a lost lead.

**Delivery is bounded at-least-once, and no stronger claim is made.** A handler can run
twice: the side effect happens, the process dies before the item is marked done, and
the next cycle retries. Attempts are bounded (`WORKER_MAX_ATTEMPTS`), so a permanently
failing item stops instead of emailing forever. `worker.test.js` contains a test that
deliberately demonstrates the duplicate, so nobody later upgrades the wording.

## What is deliberately not implemented

| Not implemented | Why | What the code does instead |
|---|---|---|
| A reachable endpoint | No Apps Script project or deployment has been created yet. | Both frontends are wired through `packages/submission-client` and build real envelopes; there is nothing for them to reach. The wiring is not what is missing. |
| Google People sync | Scoped to a later pass. | `contactSyncStatus` is `not_configured`. No contacts scope is requested in the manifest. |
| Trigger installation | Every schedule is a deliberate external operation. | The worker, digest, and retention handlers are callable and unscheduled. See [`docs/deployment.md`](../../docs/deployment.md). |
| Automated reply ingestion and deletion | There is no correction and removal promise left to ingest replies against. | The promise and the two Script Properties that gated it were **removed** on 2026-08-15, not left gated. No acknowledgement offers correction or removal. |
| Referral resolution | `refToken` is carried but inert by contract. | Stored verbatim; never resolved, linked, or reported on. |
| A business-record purge | Business records have no automatic expiry. | `planRetention` has no key for one, asserted by test. |

## Running the tests

```
pnpm test:gas-v2
```

Node's built-in runner, no dependencies. The suite walks `src` recursively and loads
every `.js` file it finds into one VM context supplied with only the globals Apps Script
provides, so a Node dependency creeping into `src` fails here instead of after a push.

See [`tests/README.md`](tests/README.md) for what each suite guards.

## Rendering the email specimens

```
node scripts/gas-v2/tools/render-previews.js <outdir>
```

Renders every approved specimen with the production renderer, fake configuration, and fake
records, then writes a self-contained contact sheet showing each at 600, 390, and 320 with
a dark approximation. It sends nothing and reads nothing from Google. Point it outside the
repository.

**A browser is not an email client.** Gmail strips the document head, Outlook renders
through the Word engine, and iOS Mail and Android apply their own dark transforms. These
previews verify structure, content, escaping, and reflow. They are not evidence that any
real client renders correctly, and no real client has been tested.
