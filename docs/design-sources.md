# Approved V2 design sources

**Approved design versions: `design@2026-07-30` (site, intake, QR),
`design@2026-07-31` (global language selector), `design@2026-08-01` (QR Contact
Exchange), and `design@2026-08-02` (QR Contact emails and the daily digest)**

This file is the bridge between the approved design package and the code. It records which
design file is authoritative for which surface, which files are required dependencies, which
are historical, and what the exported Design Index gets wrong.

Implementation tasks cite a file and section from this document, for example
"built from `AxisPoint Form Design` §7b at `design@2026-07-30`". The pull-request template
asks for that citation.

## Where the archive lives

```
/Users/zruss/Desktop/Projects/Axispoint WebV2/
  AxisPoint-Design-Pass-1-Approved-2026-07-29/
  AxisPoint-Design-Pass-2A-Approved-2026-07-29/
  AxisPoint-Design-Pass-2B-Approved-2026-07-29/
  AxisPoint-QR-Frontend-Approved-2026-07-30/
  AxisPoint-Design-Language-Selector-Approved-2026-07-31/
  AxisPoint-Design-QR-Contact-Exchange-Approved-2026-08-01/
  AxisPoint-Design-QR-Contact-Emails-Approved-2026-08-02/   <- newest export
```

The archive is **external to this repository, read-only, and must not be modified, moved,
renamed, repackaged, or committed.** Design files are large, binary-heavy, and carry
unresolved photography licensing; this text manifest exists so they never need to be in git.

**The newest export is the working input.** The seven exports are cumulative: every shared
design file is byte-identical across all of them, and each pass strictly adds files. The only
file that changes between exports is the Design Index itself, which grows as each pass is
recorded. The earlier folders are historical record with no unique content.

Package integrity is verified per pass by hashing the ZIPs **in this folder only**. Do not
compare against similarly named copies elsewhere on the machine: they are not the source of
truth, and a comparison against one proves nothing about the folder that is.

## Authoritative sources

| Surface | File | Notes |
|---|---|---|
| Homepage | `AxisPointPage.dc.html` | Homepage **only**. Props are `viewport` (desktop/mobile). See correction 1. |
| Property Management page | `AxisPoint Property Management.dc.html` | Authoritative for `/property-management`. See correction 2. |
| Asset Management, Investor Services, Partners, Contact shell | `AxisPoint System Studies.dc.html` | `page` prop: `asset-management`, `investor-services`, `partners`, `contact` |
| Intake: pathways, components, full state set | `AxisPoint Form Design.dc.html` | §6a–6e gateway/steps/states, §7a–7h pathway map, short intake, booking, language system, localization proofs, state checklist, handoff. Code Pass 10A connected the already-approved submitting, failed, and success states to a real transport; the fail-closed "unavailable" state is **not** from this source, see below |
| Localization behaviour and layout | `AxisPointLangSystem.dc.html`, `AxisPointLocaleProof.dc.html` | Authoritative for behaviour, layout, and direction. Translated copy is a **proof, not approved translation** |
| Shared footer | `AxisPointFooter.dc.html` | See correction 3 |
| QR business card | `AxisPoint QR Frontend.dc.html` | Authoritative for the surface. Four values remain unresolved, and the shipped card is **one combined page rather than the drawn three states** by owner direction, see both sections below |
| Communications and email (Pass 2A) | `AxisPoint Communications System.dc.html`, `AxisPointEmail.dc.html` | Approved. Implemented in Code Pass 9A for the website acknowledgement, the internal notification, and the booking confirmation |
| QR Contact Exchange form | `AxisPoint QR Contact Exchange.dc.html` | Approved at `design@2026-08-01`. Backend contract resolved in Code Pass 9B; the frontend is a later pass |
| QR Contact emails and the daily digest | `AxisPoint QR Contact Emails.dc.html` | Approved at `design@2026-08-02`. Implemented in Code Pass 9A |
| Letterhead and Management Proposal document (Pass 2B) | `AxisPoint Proposal and Letterhead System.dc.html` | Approved for future use. **Implementation deferred, not required for launch** |

### QR Contact Exchange, `design@2026-08-01`

| | |
|---|---|
| **Package** | `AxisPoint-Design-QR-Contact-Exchange-Approved-2026-08-01/` |
| **Authoritative** | `AxisPoint QR Contact Exchange.dc.html` |
| **Depends on** | `AxisPoint QR Frontend.dc.html` for the card surface the action is added to |
| **Cumulative** | Verified: all earlier ZIP hashes unchanged, one package added |

The approved additive form: a "Share your details" action on the QR card, seven required
and optional fields, seven contact categories, and the full state set (default, category
open, email-only, phone-only including non-US formatting, required-field validation,
invalid email, sending, success, possible match, recoverable failure, retry, close).

**Built in Code Pass 10B**, in `apps/qr/src/exchange`, submitting `contact_exchange` through
`packages/submission-client`. The backend half of the board's handoff list was settled by
Pass 9B, and the frontend half by Passes 10A and 10B:

| Board dependency | Resolved by Pass 9B |
|---|---|
| Unified V2 endpoint discriminated by `submissionKind` and `schemaVersion` | Yes, since Pass 8 |
| Server-side re-validation of every browser rule | Yes. Browser validation is a courtesy, never the boundary |
| Final phone contract, replacing the provisional seven-digit frontend floor | Yes. 7 to 20 digits, approved punctuation, stored as typed, compared on the complete normalized digit string |
| Idempotency: a retry after a timeout must not create a second contact | Yes. `submissionId` plus `payloadFingerprint`, with retry-triggered reconciliation |
| Profile source validation, so a crafted URL cannot attribute a contact to a partner | Yes. `sourceDetail` resolves only against the known slugs; anything else is `unknown` |
| Possible-match handling as an internal-only concern | Yes. Flag only, never a link or merge, and never shown to the person who submitted |
| Google Contact sync as a separate later operation, never inline | Yes. `contactSyncStatus: not_configured`, no People API code, no scope |
| Failure recovery for a submission accepted but never acknowledged to the browser | Partly. The retry path repairs a half-written request; a request never retried stays half-written, and no background sweep exists |
| Safe local development that cannot reach a live endpoint | Yes, Pass 10B. `pnpm dev` forces the endpoint empty and runs the shared client's simulator, so no request leaves the browser |
| Deliberate opt-in E2E mode | Yes, Pass 10B. `VITE_V2_SUBMISSION_ENDPOINT` only, loaded from the machine-local `.env.e2e.local`; a missing value is a hard failure and a lone V1 value is a named error |
| Spam protection mechanism | **Undecided.** Screening flags server-side; no visible captcha is designed |

Two board requirements bound the frontend, and both were met in Code Pass 10B:

1. **The category control must be built on a proven accessible select or listbox
   primitive, not bespoke keyboard logic.** A native select remains an acceptable fallback
   if assistive-technology testing exposes a defect; it was not the first choice only
   because it truncated the longest category label on iOS at 320px.
   **Built as the native select.** This repository introduces no component library, so the
   native control is the proven primitive available: arrow keys, type-ahead, Escape, the
   mobile picker, and assistive-technology behaviour come from the platform rather than from
   code written for one page. The truncation objection is answered directly by echoing the
   full selected label as wrapping text beneath the control, so the longest label is legible
   at 320px. Recorded as a deliberate deviation from the drawn treatment, taken under the
   board's own fallback clause, not an omission.
2. **A retry must preserve the same `submissionId` and payload.** A client that mints a
   fresh id on retry creates duplicate business records. See
   [`backend-v2-contract.md`](backend-v2-contract.md) §12.
   **Implemented in the shared client**, not in this surface, and verified on the wire: a
   forced failure followed by a retry produced two POSTs to a local stub carrying the same
   `submissionId` and a byte-identical payload and attribution.

### QR Contact emails and daily digest, `design@2026-08-02`

| | |
|---|---|
| **Package** | `AxisPoint-Design-QR-Contact-Emails-Approved-2026-08-02/` |
| **Authoritative** | `AxisPoint QR Contact Emails.dc.html` |
| **Depends on** | `AxisPoint Communications System.dc.html` and `AxisPointEmail.dc.html` for the Pass 2A shell, header, summary panel, and footer |
| **Index** | `AxisPoint Design Index.dc.html`, updated in the same export |
| **Cumulative** | Verified: all six earlier ZIP hashes are unchanged, one package was added |

Implemented in Code Pass 9A. What the board settles, and where the code enforces it:

- Two emails come out of a scanned card, and neither one sells anything: a transactional
  confirmation, and one conditional internal digest at 8:00 AM that replaces per-scan
  notification.
- The confirmation echoes the **display name only**. The submitted address has not been
  verified as the sender's, so no other submitted value appears.
- Deliberately absent: response-time promise, sales copy, nurture enrollment, tracking
  pixel, visible reference number, Save Contact action, invented values.
- "Gathered through" and "Current owner" are two rows, always both present. Attribution is
  immutable, ownership is current state read at generation time.
- Zero new Contacts sends nothing at all. The window advances only on confirmed delivery.
- Approximately 90 KB working ceiling per HTML part, splitting at Contact boundaries and
  never truncating.

Deviations from the drawn specimens, recorded rather than silently taken:

1. **The internal action button is omitted.** The Pass 2A specimen draws "Open the lead
   record" at a placeholder destination. The internal review surface still does not exist,
   and the QR board's own rule is that a dead link in an internal email is worse than no
   link.
2. **One `<style>` block is used** to stack key above value below 480px, which is the
   approved 390px behaviour. Every cell still carries its full inline style, so a client
   that strips the head renders the side-by-side layout correctly. The layout does not
   depend on the stylesheet.
3. **Record cost is about 3.1 KB rather than the drawn 1.6 KB**, so thirty contacts split
   into two numbered parts rather than fitting one email. Splitting is the approved
   behaviour above the ceiling; nothing is truncated and nothing clips.

### Language selector, `design@2026-07-31`

| | |
|---|---|
| **Package** | `AxisPoint-Design-Language-Selector-Approved-2026-07-31/` |
| **Authoritative** | `AxisPoint Language Selector.dc.html` |
| **Index** | `AxisPoint Design Index.dc.html`, updated in the same export |
| **Cumulative** | Verified: every earlier file is byte-identical, only the Index changed and one file was added |

Approved timing and geometry, implemented in `apps/web/src/components/LanguageSelector.tsx`:

- 1500ms hold, 130ms opacity crossfade, one word at a time
- No slide, marquee, ticker, bounce, or typewriter motion
- Fixed 82px decorative slot on desktop, 62px in the compact trigger, so the navigation never moves
- 1px by 16px hairline divider between decoration and state
- Active locale in its own slot, never animated
- Menu capped near 340px with roughly six rows visible, 54px desktop rows and 60px mobile rows
- Compact mobile trigger holds 152px and shows the two-letter locale code
- Pause on hover, on keyboard focus, and while open; selection stops the cycle for the session
- Reduced motion is static

**Registry rules, decided by the board and implemented in `apps/web/src/i18n/locales.ts`:**

- The cycle and the menu derive from **one** registry. There is no second list, and the nine
  locales are never hard-coded into the animation.
- A locale participates only when it is explicitly `enabled` **and** translation `reviewed`.
- With fewer than two available locales the trigger stays static. That is production today.
- An unavailable or unknown locale falls back to English.
- Unavailable translations are never advertised.
- No routing, persistence, `hreflang`, or backend behaviour is defined by this component.

**Corrected 2026-08-10 (Multilingual Content Rollout, PR 1): six Noto families, not seven.**
The dependency table above previously said seven. The registry in `apps/web/src/i18n/locales.ts`
names exactly six: Noto Sans SC, TC, Devanagari, Gujarati, Gurmukhi, and Arabic. Spanish and
Vietnamese render in Figtree and need no script family, which is where the miscount came from.
`PREVIEW_FONT_HREF` has always requested six.

**Fonts.** Figtree remains the brand utility typeface. The Noto script families are
language-support fonts, not a third brand face, and Simplified and Traditional Chinese use
distinct families that are never substituted for each other. Devanagari, Gujarati, Gurmukhi,
and Arabic script carry a 1.55 line height. **No script font is added to the production
document**: only English ships, so the production font payload is unchanged, and the
development preview loads the Noto families on demand. Add a family to the document head only
when its locale is approved for launch, and record the weight then.

**Still required before any locale launches:** a professional translation pass, and
native-reader verification of the CJK and Indic words, which the board calls out explicitly.

### Route map

| Route | Source |
|---|---|
| `/` | `AxisPointPage` |
| `/property-management` | `AxisPoint Property Management` |
| `/asset-management` | `AxisPoint System Studies` (`page=asset-management`) |
| `/investor-services` | `AxisPoint System Studies` (`page=investor-services`) |
| `/partners` | `AxisPoint System Studies` (`page=partners`) |
| `/contact` | `AxisPoint System Studies` (`page=contact`) for the shell, `AxisPoint Form Design` for the intake itself |

Neither Contact source is sufficient alone. The System Studies contact panel is an explicit
placeholder reading "Intake structure is being mapped separately… Fields to be defined."

## Required dependencies

Files an authoritative source cannot render without. Verified by parsing every `dc-import`.

| Authoritative file | Requires |
|---|---|
| `AxisPointPage` | `AxisPointFooter` |
| `AxisPoint System Studies` | `AxisPointFooter` |
| `AxisPoint Property Management` | `AxisPointFooter` |
| `AxisPoint Form Design` | `AxisPointFormFlow`, `AxisPointFormSystem`, `AxisPointLangSystem`, `AxisPointLocaleProof` |
| `AxisPointFormFlow` (transitive) | `AxisPointFooter` |
| `AxisPoint QR Frontend` | `AxisPointMark` |
| `AxisPoint Communications System` | `AxisPointEmail`, `AxisPointMark` |
| `AxisPoint Proposal and Letterhead System` | `AxisPointMark` |
| All files | `support.js`, Google Fonts (Figtree, Cormorant Garamond, and **six** Noto families for the nine locales) |

`AxisPointFormFlow` and `AxisPointFormSystem` are reviewed through the intake board rather than
on their own, but implementers will need them for per-screen detail. They are build inputs.

## Corrections to the exported Design Index

`AxisPoint Design Index.dc.html` ships inside the approved export and **its classifications are
stale in four places.** The archive is approved and immutable, so the corrections are recorded
here instead. Where this table and the exported Index disagree, **this table wins.**

| # | File | Index says | Correction |
|---|---|---|---|
| 1 | `AxisPointPage.dc.html` | "Homepage and Property Management" | Authoritative for the **homepage only**. It has no `page` prop and renders one page, linking out to the Property Management file |
| 2 | `AxisPoint Property Management.dc.html` | "Historical, superseded by the public site files" | **Authoritative for `/property-management`.** It is the only Property Management page design, a full seven-section page, and the target of the PM navigation link in every other file |
| 3 | `AxisPointFooter.dc.html` | "Historical, superseded by the public site files where they overlap" | **Authoritative for the shared footer.** It is a hard dependency of all three page files; the public site files contain no footer of their own |
| 4 | `AxisPoint System Studies.dc.html` | Authoritative (correct) | Confirmed authoritative for Asset Management, Investor Services, Partners, and the **Contact shell** specifically |

## Built without an approved design source (Code Passes 10A and 10B)

Some states have **no approved design**, because the approved packages were drawn before the
submission contract existed and they do not cover what a connected form does when the backend
is unreachable or unconfigured.

| Surface | State | Why it exists | What was done |
|---|---|---|---|
| Website intake | `unavailable` | A production build with no endpoint must not simulate success. It has to say plainly that nothing was sent | Reuses the **approved** error-summary alert component and its magenta error tone verbatim. Only the sentence is new |
| Website intake | `blocked` | A permanent backend rejection, and the unreachable case where an answer has no wire token, must not offer a retry that cannot work | Same approved alert component, different sentence, retry deliberately withheld |
| QR Contact Exchange | not-configured / permanent failure | Same reason. The board drew a recoverable failure with a Try again, but not the case where retrying cannot help | Reuses the **approved** failure banner and its darker magenta verbatim, changing only the second sentence and withholding Try again |
| Intake booking | taken slot, booking failure, no calendar | The approved booking screen was drawn against a fixture calendar, before a real command existed. It has no state for "that time was taken between choosing and asking" | Reuses the **approved** alert component. The taken-slot wording is the owner-approved neutral line, "That time is no longer available. Please choose another." Retry is offered only for a retryable failure |

**No new component, colour, spacing, or type style was invented for any of them.** They are
approved elements with new copy. If the owner later approves dedicated designs for these
states, that export supersedes this note. Recorded here so a reviewer is not left looking for
an approval that does not exist.

**The booking picker replaced its fixture calendar with a derived candidate list (Pass
10C).** The approved intake board draws a month grid against local sample availability. That
could not survive contact with a real command: V2 exposes no availability query, so the
month grid's greyed-out dates and struck-through slots were claims the browser has no way to
make, and its fixed "August 2026" would eventually fall outside the backend's 60-day horizon
and be refused outright. The picker now lists the business days and 30-minute slots the
backend's own rules accept, and states only that availability is confirmed when you book. A
month grid also implies the days it omits are unavailable, which is why a list replaced it
rather than a filtered calendar. Recorded as a deliberate deviation from the drawn treatment,
taken because the drawn treatment asserts facts that are not knowable, not for convenience.

## Localization: what the approved sources settle, and what they do not

`AxisPointLangSystem.dc.html` and `AxisPointLocaleProof.dc.html` are authoritative for
selector behaviour, layout, and direction, and the Localization Readiness pass followed them.
Their translated copy remains a **proof, not approved translation**.

**Settled by the approved sources, and implemented:** the nine locales and their order, the
native names and words, Simplified and Traditional Chinese as separate entries with distinct
font stacks, Urdu as RTL, the launch gate that unavailable translations are never advertised,
and the rule that the registry is never duplicated. That last one had been violated by two
further copies in the intake; they are now deleted.

**NOT settled by any approved source, and therefore not invented:**

- **A public locale routing contract.** Nothing approves `/es/...` versus `?lang=es` versus a
  cookie, so no URL shape was shipped. `setLocale` is the seam a decision plugs into. This
  remains an open owner decision.
- **Locale persistence** across visits.
- **`hreflang`**, which cannot be correct before translated pages exist.
- **A QR language selector.** The QR Contact Exchange is English-only under its approved
  design, and stayed that way.

**Native-reader review is still required** for every non-English entry, including the native
names and words already in the registry, before any of them could launch.

**Where the English intake copy comes from, and what that means for the catalog.** The
approved intake sources are authoritative for the copy itself; the message catalog is only a
place to hold it. Because the catalog is partial by design (see the localization entry in
[`STATUS.md`](STATUS.md)), the safe procedure when migrating a further string is to take the
**rendered** text as the transcription source and diff the rendered result afterwards, rather
than retyping from an approved file or from memory. That is not a change of authority: it is
how you prove the migration was lossless. Several catalog values in this pass were first
written from memory and were wrong, and a bulk substitution attempt was reverted after it
would have altered a visible short-pathway label as a side effect. The Multilingual Content
Rollout pass owns extending the catalog to the remaining intake and marketing copy.

## Historical, not build inputs

Read for reasoning if useful. Do not implement from these, and do not let them become
requirements.

- `AxisPoint Direction.dc.html` — earlier direction
- `AxisPoint Photography Fit Study.dc.html`, `AxisPointPhotoFindings.dc.html`, `AxisPointPhotoSlot.dc.html` — photography studies; final crops live in the public-site files
- `AxisPointEmail.dc.html`, `AxisPointMark.dc.html` — components rendered through their boards; usage rules live in the Pass 2A board
- `uploads/axispoint-homepage-concept/`, `uploads/axispoint-one-prompt-design-package/` — superseded concepts

## Photography and licence ledger

**No photography enters this repository until its licence is confirmed.** When cleared, commit
only optimized production derivatives and record source, photographer, licence, asset ID, and
alt text alongside them.

The authoritative public-site files reference exactly four images:

| Slot | Referenced asset | Source | Licence status |
|---|---|---|---|
| Homepage hero | `assets/final/01-homepage.jpeg` | Adobe **#158947695** | ⚠️ **Confirm licence record** |
| Property Management hero | `assets/final/02-property-management.jpeg` | Adobe **#196537616** | ⚠️ **Confirm licence record** |
| Asset Management band | `assets/final/03-asset-management.jpeg` | Adobe **#110458363** | ⚠️ **Confirm licence record** |
| Investor Services band | `assets/final/04-investor-services.jpeg` | Juan Nino, Unsplash | ✅ Cleared (Unsplash Licence) |

Three Adobe assets require external confirmation that the licence was actually purchased. The
`assets/final/` files in the export are clean and high-resolution rather than watermarked
comps, which is consistent with licensing having happened, but the archive cannot prove it.

**Not launch blockers:**

- Adobe **#217495105** (Houston market band) — historical, not referenced by any authoritative file
- The Property Management retail-module image ("still to be selected" in the slot spec) — historical, unreferenced
- The Open Graph 1200×630 derivative — a later launch deliverable, not a Pass-level dependency

Production delivery rules (AVIF → WebP → JPEG, `srcset`, desktop and mobile crops, weight
budgets) are in the archive's `image-slot-spec.md`.

## QR: four unresolved values

The QR design is complete and approved. The board's own §q13 lists seven values as unresolved
**by design**. Three have since been resolved by owner decision:

- **A verified phone for each partner**, resolved 2026-08-15 by
  [`PARTNER_CONTACTS.md`](PARTNER_CONTACTS.md), which carries owner-confirmed current phone
  and email values for both partners.
- **Verified email behaviour for each partner**, resolved 2026-08-17 by the single-page
  collapse recorded in the next section: both partners' direct addresses are shown on the
  card, so the "route Email to `info@axispoint.llc` with disclosure" alternative is not taken.
  The firm address remains the fallback in code if a partner value is ever cleared.
- **The final permanent profile URL**, no longer three URLs to decide. One page needs one
  address, so what remains is a hosting question rather than a design one. It is tracked as a
  launch item in [`STATUS.md`](STATUS.md), not as an unresolved design value.

The remaining four **block production completion and physical-card cutover. They do not block
frontend implementation.**

1. Whether a firm phone will ever exist
2. The contact-file generation and delivery method
3. Whether the organization note is set, and its exact wording
4. Whether a mailing address appears anywhere (currently it does not; only "Houston, Texas")

A QR implementation pass may proceed using **configurable local fixture data and simulated
contact-download behaviour.** It must not silently select a permanent public URL or a
production delivery architecture.

**The board designed V2 QR with no embedded intake. The shipped app has one, by a later
owner-confirmed decision.** "Request a Management Proposal" is still a normal link into the
shared website intake, exactly as the board specified, and that link is unchanged. Alongside
it, `apps/qr` retains its full Contact Exchange intake: the form, storage, the acknowledgement
email, the daily digest, and matching all remain. It submits a `contact_exchange` envelope
through `packages/submission-client` and resolves `VITE_V2_SUBMISSION_ENDPOINT`, never
`VITE_FORM_ENDPOINT`, which names the retired V1 deployment and is now recognised only in
order to be rejected. See [`system-classification.md`](system-classification.md) for the QR
system's current classification. Any future vCard delivery endpoint is a separate, undecided
contract.

## QR single-page collapse, owner-directed deviation, 2026-08-17

**This is a deliberate, documented departure from the approved board, not a correction to it
and not a silent overwrite of it.** `AxisPoint QR Frontend.dc.html` remains the authoritative
approved source and is unchanged; the archive is immutable and nothing in it was edited. Where
the board and this section disagree about what ships, **this section wins, and it says why.**

It follows the precedent set by the **owner-directed copy correction of 2026-07-31**, which
replaced the board's unresolved-card sentence ("This card did not resolve to a partner
profile. Reach the firm directly and we will route you to the right partner.") with copy that
led with the action instead. That correction was recorded in the source it changed rather than
here; this one is larger than a sentence, so it is recorded in this file where deviations
belong.

### What the board drew, and what ships instead

| | Approved board | Shipped since 2026-08-17 |
|---|---|---|
| Pages | One template, three states, selected by `?profile=` | **One combined page.** No parameter, no states, nothing to select |
| Identity | One partner per scan, or a firm fallback for a card that did not resolve | **Both partners together**, each with name, title, direct line, and direct address |
| Save action | One contact record, the scanned partner or the firm | **Exactly two records, Zachary and Ethaniel individually.** No third combined or firm-level record |
| Attribution | Per-partner: a scan of Zachary's card recorded `zachary_russell` | **Firm-level only.** Every exchange sends `axispoint-partners` |

### Why, and what it cost

The owner directed one page carrying both partners. Two consequences were weighed and
**accepted explicitly**, and neither is a defect to be repaired later by somebody who reads
this and assumes it was an oversight:

1. **Per-partner attribution in the daily digest is lost.** The browser no longer has a
   partner-specific identifier to send, so it sends the firm slug and does not invent one.
   The backend resolves that to `acquisitionSource: 'firm'` with `scannedPartner` empty, and
   the digest delivers those Contacts in its shared section **to both partners**. That routing
   path already existed and was already tested; **no backend, digest, or contract change was
   made or needed.** `SLUG_TO_PARTNER` still resolves both partner slugs, so restoring
   per-partner cards later is a frontend change alone.
   Pinned by `apps/qr/tests/exchange.wire.test.ts`, deliberately, so the cost reads as a
   decision rather than as an absence.
2. **The firm fallback state is gone, and its copy with it.** That includes the 2026-07-31
   owner-directed replacement above: there is no unresolved card to describe when every scan
   lands on the same page, and keeping the sentence would tell a visitor their card failed to
   resolve when nothing failed. `FIRM.partnersLine` ("Partner-led from Houston by Zachary
   Russell and Ethaniel Vu.") went with it as redundant, since the page now names both
   partners in full, with their details, immediately below where that line used to sit.

### What did not change

No new component, colour, spacing, or type style was invented. The header, the 480px measure,
the single column with no second breakpoint, the teal-filled Save control as the only 54px
control, the outlined "Share your details" action, the quiet route rows, the footer, and the
approved missing-data rules are all the board's, unchanged. The missing-data rules are still
implemented rather than assumed away: a null phone omits its Call row, a null email falls back
to the firm inbox with that disclosed. Both branches are currently unreachable, because both
partners have confirmed values, which is the correct reason for a state to be unreachable.

### Not verified on a real device

The Save action builds the two-record file in memory and hands it to the browser as a `blob:`
URL through a synthetic anchor click. **That delivery path has never been exercised on a real
iPhone or a real Android handset, not even for the single-record case it replaces**, and a
multi-record file adds a second unverified behaviour: some contact importers read only the
first record in a stream. `apps/qr/tests/vcard.test.ts` pins the bytes of the file and says
nothing about what a phone does with it. This is an open manual verification, tracked in
[`STATUS.md`](STATUS.md), and it is a launch blocker rather than a finished item.

## Recording future design revisions

A new approved export becomes a new dated folder in the archive. Update this file's version
line, tables, and ledger in the same task, and add a dated line to
[`CHANGELOG.md`](CHANGELOG.md). Never edit an existing export.
