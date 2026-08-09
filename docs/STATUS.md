# STATUS

The concise state record for the V2 transition. Update it as part of each pass. If a line has
not changed, leave it alone. This replaces re-auditing; it is not a project-management board.

_Last updated: 2026-08-08 (Localization Readiness)_

## Where things stand

| | |
|---|---|
| **Approved design versions** | `design@2026-07-30` (site, intake, QR), `design@2026-07-31` (language selector), `design@2026-08-01` (QR Contact Exchange), `design@2026-08-02` (QR Contact emails and digest). See [`design-sources.md`](design-sources.md) |
| **Current code pass** | Localization Readiness, complete. The localization architecture and the stable form values are staging-ready; the full intake and marketing copy migration and all real translation are deferred to Multilingual Content Rollout. English remains the sole enabled and reviewed locale (no endpoint exists, nothing deployed) |
| **Completed passes** | Code Pass 1 audit (read-only). Pass 0, workflow reconciliation. Pass 2, shared frontend foundations. Pass 3, public pages and routes. Pass 4, V2 intake frontend. Pass 5, V2 QR frontend. Pass 6, language-selector component. Pass 7, backend contract audit (read-only). Pass 8, backend scaffold and contract. Pass 9A, email system, daily QR digest, retention, and policy reconciliation. Pass 9B, six-tab storage model, partial-write recovery, and one booking rule. Pass 9C, booking eligibility forwarded on the success response. Pass 10A, shared submission client and website-intake connection. Pass 10B, QR Contact Exchange frontend. Pass 10C, booking command connected |
| **Next pass** | Staging, planned in [`staging-provisioning.md`](staging-provisioning.md) and not yet provisioned. Every V2 surface is connected to the shared client; what remains is standing up a backend. **No endpoint exists and none has been contacted** |

## Routes

All six approved routes resolve. The Pass 2 missing-route warning is closed.

| Route | Source | Status |
|---|---|---|
| `/` | `AxisPointPage.dc.html` | Live |
| `/property-management` | `AxisPoint Property Management.dc.html` | Live |
| `/asset-management` | `AxisPoint System Studies.dc.html` | Live |
| `/investor-services` | `AxisPoint System Studies.dc.html` | Live |
| `/partners` | `AxisPoint System Studies.dc.html` | Live |
| `/contact` | `AxisPoint System Studies.dc.html` | Live, V2 intake, connected to the shared submission client, see below |
| `/share/:code` | V1 | Retained untouched, outside the site chrome |

`/services` and `/team` were removed. No redirect was added: nothing in this repository is
deployed and no external link depends on them. If that changes before launch, redirects belong
to the hosting configuration rather than to client-side routing.

## Temporary, until later passes

**The visible frontend is now entirely V2.** The V1 `ContactForm` is no longer mounted in
`apps/web`. The approved intake lives in `apps/web/src/intake`.

**The website intake now submits through the shared client, and there is still nothing to
submit to.** `packages/submission-client` is the shared transport boundary, and since Pass
10B **both apps import it**: `apps/web` for `service_inquiry`, `apps/qr` for
`contact_exchange`.
`apps/web/src/intake` builds a real `schemaVersion` 1 envelope and hands it over. Whether
anything is sent depends only on the build: `pnpm dev` simulates, a production build with
`VITE_V2_SUBMISSION_ENDPOINT` sends, and a production build without one fails closed with an honest
"nothing was sent" rather than a simulated success. **No endpoint exists**, so every check
so far ran against the dev simulator or a local stub on `127.0.0.1`. See
[`backend-v2-contract.md` §19](backend-v2-contract.md#19-the-frontend-transport-boundary).

**The booking command is connected through the shared client (Pass 10C).** Choosing a time
now issues a real `booking_request` carrying the `leadId` the submission returned. It is a
separate command after the submission, never a block inside one, and the backend needed no
change to accept it.

**Backend eligibility remains authoritative.** Whether a call is offered comes from
`bookingEligible` on the submission response, and the command re-evaluates the rule against
the stored Lead when somebody actually books. No pathway policy is derived in the frontend.

**Candidate times are policy-valid requests, not availability.** V2 exposes no availability
query, so the browser cannot know what is free and does not pretend to. The picker derives
candidates from the backend's own rules (business days, 09:00 to 17:00, at least an hour
ahead, within 60 days, 30-minute slots, America/Chicago with real daylight-saving offsets),
so every offered time is one the command's window validation accepts. Nothing is ever drawn
as taken. The hard-coded "August 2026" fixture, its invented taken-slots, and its
grey-out-before-the-10th rule are gone: all three were fabrications, and the fixed month
would eventually have fallen outside the horizon and been refused outright.

**A taken slot is an ordinary answer, not a failure.** `SLOT_UNAVAILABLE` renders the
approved neutral line, "That time is no longer available. Please choose another." It offers
no retry, because retrying the same request would be refused again; picking another time is
the fix.

**Retry preserves the `bookingRequestId`; a material edit replaces it.** An unchanged retry
resends the same id, so a timeout cannot create a second calendar hold. Changing the slot or
the mode mints a new id, so the backend cannot replay the old booking and confirm a time the
visitor moved away from.

**One shared AxisPoint calendar**, unchanged: a single `AXP_CALENDAR_ID` Script Property. No
real calendar was contacted and no Google resource exists.

## Localization readiness

**English is the only enabled and reviewed locale, and nothing else is advertised.** All nine
codes remain accepted and stored; the other eight stay `enabled: false` and `review:
'unreviewed'`. No translation was written, machine-generated, or fabricated in this pass.

**What is staging-ready: the localization architecture and the stable form values**

Two things are finished to a standard that a later translation pass can build on without
revisiting them. Everything else in this section is explicitly deferred.

- **One canonical registry.** `apps/web/src/i18n/locales.ts` is now the only locale list. The
  intake's duplicate `APPROVED_LANGUAGES` and the mapper's third English-name table are
  deleted.
- **Every intake control separates display text from its stored value.** This is the part that
  had to happen before any translation, not after. Six controls (property type, property scope,
  situation, involvement, timing, and the two topic pickers) previously stored their **English
  label** as draft state and used that label as the key into the wire-mapping tables.
  Translating the UI would therefore have broken every Management Proposal submission and
  silently mis-stored involvement and scope. Each control is now a `Choice` of a stable
  snake_case `value` plus a `labelKey` into the catalog; draft state, conditional logic,
  summaries, and the envelope all use the token, and only the rendered label comes from the
  catalog. A synthetic-catalog regression test changes every visible label and asserts the
  submitted envelope is byte-identical.
- **A real bug is fixed.** The select offered "Chinese (Simplified)" while the mapper matched
  "Simplified Chinese", so both Chinese follow-up preferences fell through to `null` and were
  silently discarded. The select now stores locale **codes**, and a regression test drives the
  actual option values.
- **App-level locale state.** The selector's choice was previously local to the navigation, so
  nothing else could observe it and the intake hardcoded `pageLocale: 'en'`. The active page
  locale now reaches the envelope.
- **Booking display is locale-aware, the instant is not.** Day and time labels follow the
  reader's language; `slotStart` is still computed in the firm's zone with a real offset, so
  changing display language cannot move a meeting.
- **Backend dispatch is connected.** `resolveOutboundLocale` and `LAUNCH_READY_LOCALES`
  existed since Pass 9A but nothing called them. Visitor acknowledgement and booking
  confirmation now select templates through them, with English the only real set and one
  documented fallback rule.

**What is deferred to the Multilingual Content Rollout pass**

The copy migration itself, and all real translation, are deliberately not part of this pass.

- **The catalog is partial by design, and its boundary is exact.** `messages.ts` holds **92
  keys**, every one of them consumed: the six stable-token control label sets, the gateway
  cards, the two short pathways, validation messages, the review summaries, and the booking
  chrome. Step headings, field labels, placeholders, help text, and the submission-state
  screens are **still hardcoded English in the JSX**. An attempt to migrate them was made in
  this pass and was **reverted on review**, because a bulk JSX substitution can leave a partial
  rewrite wherever a replacement is missing, and one of its corrections would have changed a
  visible short-pathway string (`organizationLabel`) as a side effect. The 49 catalog keys that
  migration had added were removed with it. Extending the catalog is the rollout pass's job,
  done screen by screen against rendered output.
- **No marketing page copy is in the catalog.** Roughly **1,500 lines** of hardcoded visitor
  copy across the seven pages, the footer, and the navigation still need migrating. The site is
  **not** translation-ready end to end, and this pass does not claim it is.
- **No translated content exists** for any locale, and **native-reader review is still
  required** for every non-English entry in the registry, including the native words already
  in it.
- **The locale routing decision is explicitly left open** by the owner, and neither routing
  nor persistence is implemented. Because locale state lives above the router, a chosen
  locale **survives normal in-app navigation while the application remains loaded**, and
  **resets on a full reload, a direct load, or a new tab**. `setLocale` is the seam a routing
  decision plugs into when one is made.
- **QR Contact Exchange stays honestly English-only**, per its approved design. No language
  selector was added to it.

**The V2 manifest requests exactly three OAuth scopes**, each backed by an API the code
calls: `spreadsheets` (`SpreadsheetApp`), `calendar` (`CalendarApp`), and `script.send_mail`
(`MailApp.sendEmail`). Four requests were removed as unused before any consent screen was
ever shown, most importantly `https://mail.google.com/`, which grants full read, send, and
delete access to the deploying account's mailbox where only send is needed. The unused
advanced Calendar service was removed with them. `deployability.test.js` pins the exact set.

**`AXP_REMOVAL_PROCEDURE_CONFIGURED` and `AXP_REPLY_TO_MONITORED` are both `false`**, so the
QR acknowledgement omits its correction and removal lines and nothing is displayed or sent
promising that information will be corrected or removed. AxisPoint retains voluntarily
submitted business information for normal operations, and any rare information request is
handled manually by Zach on a case-by-case basis. **This is not an approved legal-compliance
policy**, and no automated removal system exists or is planned.

**The QR Contact Exchange is implemented and connected to the shared client (Pass 10B).**
`apps/qr/src/exchange` submits `submissionKind: 'contact_exchange'` through
`packages/submission-client`, so both apps now go through the one transport boundary and
there is no second transport or wire-token list anywhere. Whether anything is sent depends
only on the build, exactly as for the website: `pnpm dev` simulates with zero network, and a
production build without `VITE_V2_SUBMISSION_ENDPOINT` fails closed with an honest "nothing
was sent" rather than a simulated success. **No endpoint exists**, so every check ran against
the dev simulator or a local stub on `127.0.0.1`.

**A QR submission creates a Submission and a Contact, never a Lead.** The category is a
filing label, not a router: it never creates a service lead, changes the copy, or changes
what happens next. A Lead is created only when someone deliberately enters the website
intake, or when a partner converts the contact by hand.

**Gathered-through attribution and ownership stay separate.** The browser sends only the
scan, `sourceCategory: 'qr'` plus the card slug. The backend derives the immutable
`acquisitionSource` and `scannedPartner` from it and leaves `ownerPartner` empty for every
record, including one gathered through a partner's own card: a scan gives a partner a name,
not a claim. An unrecognised slug resolves to `unknown` and is deliberately not rewritten to
the firm, because it is evidence a printed card is wrong.

**The category control is the approved native-select fallback.** The board draws a custom
button and listbox but binds the implementation to a proven accessible primitive rather than
bespoke keyboard logic, naming a native select as acceptable. Its one stated objection to the
native control was iOS truncating the longest label at 320px, which is answered by echoing
the full selected label as wrapping text beneath the control.

**Form data is held in memory only.** Nothing is written to `localStorage`,
`sessionStorage`, cookies, or the URL, and a success clears the envelope. A page reload ends
the attempt; there is no resumable draft.

**Two of the six inventoried pathways are deferred for launch scope.** Referral Partner and
Submit a Referral are not exposed as gateway choices, their forms are not built, and none of
their V1 role values were inherited. This is a deliberate deviation from the six-pathway
inventory in the approved board, not an omission.

**Asset Management is a scope, not a pathway.** `?intent=asset-management` enters the
Management Proposal flow with the PM plus AM involvement answer preselected. The frontend
model records `pathway: 'management-proposal'` with `scope: 'pm-plus-am'`. No backend role
was added.

**`?ref=` is transmitted as an inert `refToken`, and nothing resolves it.** Since Pass 10A
the value travels on the envelope's attribution as `refToken`. It is **not** resolved to a
referrer, not linked to any record, not validated, and not acted upon anywhere; it is
recorded so the data exists when referral attribution is designed. Referral attribution as a
feature remains deferred.

**The V1 form code stays in `packages/brand` as unreferenced legacy code**, awaiting a
dedicated cleanup. No application imports `ContactForm` any more, `apps/qr` included. See
"Dead code recorded, not removed" below for the detail.

**`/share/:code` is untouched and isolated.** Note for future verification: it hard-redirects
to `https://axispoint.llc` via `window.location`, so it must not be navigated during local
browser testing. Verify it by diff instead. Its retirement decision remains separate.

**The QR app is the approved V2 card, plus the approved Contact Exchange.** `apps/qr` was
rebuilt from `AxisPoint QR Frontend.dc.html`. It does not import the V1 `ContactForm`, embeds
no service intake, and generates no QR code. Save Contact is simulated and local, and the
Management Proposal action links into the shared website intake. Pass 10B added the one
approved additive action, "Share your details", directly under Save contact, opening the
full-screen exchange described above.

**`apps/qr` reads `VITE_V2_SUBMISSION_ENDPOINT`, not `VITE_FORM_ENDPOINT` (changed in Pass
10B).** The old name is the **V1** deployment and speaks a different payload shape, so
pointing a V2 `contact_exchange` envelope at it would fail in a way that reads as a backend
bug. In e2e mode a lone V1 value is a hard error that names the problem. Both apps now use
the V2 name.

**The QR profile URL is still an open decision, so no routing contract was shipped.** Profile
selection uses a local, development-only preview key (`?profile=`), explicitly not presented as
the permanent public URL. In production an unknown or absent key resolves to the approved firm
fallback.

**Partner phone numbers and direct email addresses remain unconfigured in the QR app.**
`packages/brand/src/team.ts`, `packages/brand/src/utils/vcard.ts`, and the README all carry
values, but the approved contact-record ledger marks partner phone and partner email as
"Needs verification" and they are still listed below as open owner decisions. The QR fixtures
hold `null` and the UI follows the approved missing-data rules until the owner confirms them.
Filling in two fields per partner is the only change required afterwards.

**Dead code recorded, not removed.** With the QR rebuild, no application imports the V1
`ContactForm`, its step components, or `utils/vcard.ts` any more; the only remaining references
are inside `packages/brand` itself. The code is retained deliberately: deleting it was not
required for this pass, and it is the reference for behaviours the V2 backend contract has not
yet replaced. Retire it in a dedicated cleanup once the backend work is settled.

**The language selector is a real control, but the site is still English-only.** The approved
two-slot selector replaced the static English label in the header. Selecting a language changes
the control alone: nothing is translated, no route changes, no choice is persisted, and no
locale is stored with a submission.

**Corrected by the Localization Readiness pass.** The sentence above described the language
selector pass and is no longer true of the system: the active page locale and the visitor's
follow-up preference are both carried on the envelope and stored, as two separate facts. See
the localization entry below.

**Production shows English only, and the trigger is static.** English is the one locale that is
both enabled and translation-reviewed, and the approved rule is that the trigger does not cycle
with fewer than two available locales. The other eight sit in the registry as
`enabled: false, review: 'unreviewed'`, so they are never advertised.

**Remaining dependencies before any second locale launches:**

1. A professional translation pass per locale. Nothing here is reviewed copy.
2. Native-reader verification of the CJK and Indic words, which the approved board requires
   explicitly, including whether the 1.5s hold reads as a flicker in any script.
3. A decision on which locales launch and in what order.
4. Adding that script's font family to the production document, and recording its weight. No
   script font ships today; the development preview loads them on demand.
5. Locale routing, persistence, `hreflang`, and storing the locale with a submission. All out
   of scope for the component pass.

Enabling a locale is then a two-field change in `apps/web/src/i18n/locales.ts`.

**Legal copy review is a prelaunch check.** The footer disclaimer is carried forward unchanged.

## The V2 backend: written, tested, connected to nothing

`scripts/gas-v2` now holds a complete V2 backend implementing `schemaVersion` 1. The full
contract is [`backend-v2-contract.md`](backend-v2-contract.md); the project's own rules are in
[`scripts/gas-v2/README.md`](../scripts/gas-v2/README.md).

**Backend status: `merged`.** Nothing beyond that. There is **no** `.clasp.json`, Apps Script
project, Sheet, Script Property, trigger, or deployment, and neither frontend points at it. No
`clasp push` or `clasp deploy` has been run and none is implied by the merge. V1
(`scripts/gas/Code.gs`) is untouched and remains the deployed backend.

**Emails, the digest, retention maintenance, and Calendar are coded, locally tested,
committed, and merged. None of them is live.** No email has been sent, no digest has run, no
Calendar has been touched, and no trigger exists.

The suite is `pnpm test:gas-v2` (412 tests), running in CI alongside the unchanged V1 suite.

### The six-tab storage model

| Tab | Holds | Mutability |
|---|---|---|
| `Submissions` | One immutable record of every accepted request | **Insert-only** |
| `Deliveries` | Acknowledgement, notification, and digest state | Mutable |
| `Leads` | Website service inquiries **only** | Mutable |
| `Contacts` | QR Contact Exchanges **only** | Mutable |
| `Work` | The idempotent side-effect queue | Mutable |
| `Log` | Operational history, retained 90 days | Append, then expire |

Every accepted request creates one Submission and **exactly one** business record: a
service inquiry creates a Lead and no Contact, a contact exchange creates a Contact and no
Lead. Until Pass 9B every submission wrote a Lead row, which left QR rows in the Leads tab
with an empty pathway and a qualification state nobody would ever set.

**Matching flags and never links.** An exact normalized email or exact full normalized
phone records a possible-match flag for a human. It never automatically links, merges,
overwrites, or updates an existing Contact. Every QR exchange creates a new Contact.

**Partial-write recovery is retry-triggered.** The Submission is written first because it
cannot be reconstructed, which means a failure after it can leave a request half-written. A
retry carrying the same `submissionId` and a materially identical payload, attribution, and
locale repairs the missing Lead or Contact, Delivery row, or work items idempotently,
using the fingerprint-verified retry envelope together with the Submission's recorded
identifiers, timestamp, screening result, and match flags. Existing records are never
duplicated. A reused `submissionId` carrying materially different data returns
`SUBMISSION_ID_CONFLICT` and stores nothing.

**There is no background sweep.** A request that is never retried stays half-written, and
the repair is logged at error level so the event leaves evidence. Full contract in
[`backend-v2-contract.md`](backend-v2-contract.md) §10 and §12.

**Binding requirement on the future frontend:** the shared submission client must preserve
the same `submissionId` and payload across transport retries. A client that mints a fresh
id on retry creates duplicate business records.

**`payloadFingerprint` is an idempotency and conflict-detection guard only.** It is not
authentication, not authorization, and not a security credential.

**One booking rule.** `isBookablePathway(pathway, serviceScope)` is the single definition,
used by both the intake response and the booking command. `bookingEligible` is stored on
the Lead as the intake-time snapshot for the frontend and a future dashboard; it is not a
competing policy, and the command re-evaluates the rule against the stored Lead.

**Pass 9C forwards `bookingEligible` on the HTTP success response.** It was computed at
intake and returned by the domain layer, but dropped by the transport layer, so a frontend
had no way to learn it except by re-deriving the policy itself. It is now always present
and always a strict boolean: `true` for Management Proposal at any scope, `false` for
Investor Services, General Inquiry, and QR Contact Exchange. This is an additive field
exposing an existing backend decision, not a new policy, and no schema-version bump was
needed because no V2 consumer exists. **The frontend must trust this field and must not
implement its own booking policy.**

**What Pass 8 settled, in code:** the discriminated envelope and its versioning, the stable
snake_case token vocabulary with display strings rejected outright, server-owned field
rejection, the Lead/Contact split, suggestion-only identity matching, flag-never-discard spam
screening, booking as a post-submission command, and a bounded at-least-once work queue whose
duplicate-delivery limit is asserted by a test rather than papered over.

**What Pass 9A added:** the approved email templates as one canonical renderer, the QR Contact
acknowledgement, the conditional daily QR digest with delivery-bound state and size splitting,
and the retention policy. It also **corrected ten Pass 8 positions** within `schemaVersion` 1,
listed in [`backend-v2-contract.md`](backend-v2-contract.md) §16. The headline corrections:
Contact Exchange now gets an acknowledgement, per-scan notification is replaced by the digest,
a QR scan no longer assigns ownership, matching is exact-evidence-only, phone is 7 to 20 digits
compared in full, SLA is one number (5:00 PM next business day), and booking never falsely
confirms.

**What Pass 9A deliberately did not do:** frontend wiring, any real endpoint, any Google
resource, any trigger installation, any real email, any Calendar operation, Google People sync,
referral behaviour, and any dashboard or CRM surface.

### Open backend decisions still outstanding

The contract now states a defensible position for each of these, so they are decisions to
**confirm or change**, not blanks. They are the reason the frontend is not yet wired.

| Decision | Position taken in code |
|---|---|
| Required vs optional fields | `fullName` and `email` required on an inquiry; Contact Exchange needs one of email or phone |
| Booking availability rules | Management Proposal only. Mon to Fri, 09:00 to 17:00 project time, 60 minutes to 60 days ahead, both ends inside one day |
| Whether the referral code is transmitted | Accepted and stored verbatim, resolved to nothing |
| Dedupe and merge semantics | Exact normalized email or exact normalized full phone links. Nothing weaker is evidence |
| Retention | **Settled and implemented.** Business records never expire; operational records expire at 90 days; pending work is never purged. No trigger installed |
| Storage boundary | **Settled and implemented.** Six tabs; one Submission plus exactly one business record per request |
| Duplicate handling | **Settled and implemented.** Flag only, never an automatic link or merge |
| V1 lead migration | Not implemented (documented default: no) |
| Email recipients | Read from Script Properties by name; no address exists in the repository |
| SLA targets | **Settled.** One policy: 5:00 PM `America/Chicago` on the next business day, every pathway. Contact Exchange has none |

## Deployment state

| | |
|---|---|
| **V1 GAS backend** | **Deployed, production version @28.** Live and serving the current sites |
| **V2 GAS backend** | **Code exists and is tested; nothing external does.** `scripts/gas-v2` is at status `merged`. No Apps Script project, `.clasp.json`, Sheet, Script Properties, triggers, or deployment |
| **This repository's frontend** | **Has never successfully deployed through GitHub Actions.** The two FTP workflows fail at the FTP step because FTP secrets are not configured |
| **Live public sites** | A separate, older, hand-uploaded build unrelated to this repository's git history |
| **Going live** | A future configuration decision (adding FTP secrets), not a git action. Merging to `main` deploys nothing |

Note the distinction: the **V1 GAS backend is deployed**; the **frontend in this repository is
not**. Those are independent facts and should not be collapsed into a single "deployed" claim.

## Deferred

- Referral Partner and Submit a Referral pathway expansion (discoverability preserved)
- AppFolio integration
- Pass 2B letterhead and Management Proposal documents (approved, not required for launch)
- Learn / content publishing

## Open owner decisions

Only decisions that genuinely block work. Settled positioning, CTA wording, the language
system, partner titles, referral deferral, AppFolio deferral, QR scope, the repository
decision, and the clean-rebuild decision are **not** reopened here.

**QR, blocks production completion and physical-card cutover (not frontend implementation):**
the seven unresolved values in [`design-sources.md`](design-sources.md) — partner phones,
partner email behaviour, whether a firm phone will exist, **the permanent profile URL**,
contact-file delivery, organization-note wording, and whether a mailing address appears.

**Photography: resolved 2026-07-30.** The owner confirmed Adobe #158947695, #196537616, and
#110458363 are licensed. #04 is the cleared Juan Nino Unsplash asset. See
[`asset-catalog.md`](asset-catalog.md). The 1200x630 Open Graph image remains a later launch
deliverable, and no `og:image` tag is emitted until it exists.

**Intake, blocks Pass 5 completion:** required-vs-optional per field; booking availability
rules; the launch locale list and per-language order; document-request storage, retention, and
link expiry.

**Backend, blocks bringing the V2 project up (no longer blocks writing it):** confirm or change
the positions in the table above, and decide the Sheet, calendar, and notification addresses
that the Script Properties will hold.

**Two hard launch blockers for the QR acknowledgement**, reported by the backend's own health
check and enforced in the template rather than assumed:

1. A **monitored Reply-To mailbox**. The approved copy promises that a reply reaches a human.
2. A **documented correction and removal procedure with a named accountable person**. Removal
   is manual; no automated system exists or is designed.

Until both are configured, the correction and removal lines are omitted from the email
entirely rather than printed and unkeepable.

## Known risks

- The permanent QR profile URL is printed on physical cards and cannot be revised after printing
- `qr.axispoint.llc` has document root `/home/axisipak/public_html/qr`, but `deploy-qr.yml`
  targets `./qr.axispoint.llc/`. These do not match and must be reconciled at launch
- FTP deploy workflows currently add and overwrite but never delete, so stale files would
  persist after a deploy. See [`deployment.md`](deployment.md)
- Once FTP secrets exist, every push to `main` deploys immediately with no approval gate.
  Decide on a gate **before** adding the secrets
- Deleting a live Google Sheet tab is not git-revertible

## Rollback anchors

| Anchor | Commit | Meaning |
|---|---|---|
| `v1-stable` | `c237a09` | Historical bookmark, harmless, retained |
| `pre-v2-clean-rebuild` | `d194e7e` | **Created and pushed 2026-07-30.** Annotated, present on `origin`. The baseline immediately before the clean V2 rebuild. Named this way rather than `v1-pre-rebuild` because the baseline already contains early V2 work, so it is not a pure V1 marker |

To roll the frontend back to the pre-rebuild baseline, reset to `pre-v2-clean-rebuild`. Nothing
is deployed from this repository, so a rollback here changes no running system.
