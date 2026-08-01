# Approved V2 design sources

**Approved design versions: `design@2026-07-30` (site, intake, QR) and
`design@2026-07-31` (global language selector)**

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
  AxisPoint-QR-Frontend-Approved-2026-07-30/   <- design@2026-07-30, the working input
```

The archive is **external to this repository, read-only, and must not be modified, moved,
renamed, repackaged, or committed.** Design files are large, binary-heavy, and carry
unresolved photography licensing; this text manifest exists so they never need to be in git.

**Only the 2026-07-30 QR export is a working input.** The four exports are cumulative: every
shared design file is byte-identical across all four, and each pass strictly adds files. The
only file that changes between exports is the Design Index itself, which grows as each pass is
recorded. The three earlier folders are historical record with no unique content.

## Authoritative sources

| Surface | File | Notes |
|---|---|---|
| Homepage | `AxisPointPage.dc.html` | Homepage **only**. Props are `viewport` (desktop/mobile). See correction 1. |
| Property Management page | `AxisPoint Property Management.dc.html` | Authoritative for `/property-management`. See correction 2. |
| Asset Management, Investor Services, Partners, Contact shell | `AxisPoint System Studies.dc.html` | `page` prop: `asset-management`, `investor-services`, `partners`, `contact` |
| Intake: pathways, components, full state set | `AxisPoint Form Design.dc.html` | §6a–6e gateway/steps/states, §7a–7h pathway map, short intake, booking, language system, localization proofs, state checklist, handoff |
| Localization behaviour and layout | `AxisPointLangSystem.dc.html`, `AxisPointLocaleProof.dc.html` | Authoritative for behaviour, layout, and direction. Translated copy is a **proof, not approved translation** |
| Shared footer | `AxisPointFooter.dc.html` | See correction 3 |
| QR business card | `AxisPoint QR Frontend.dc.html` | Authoritative for the surface. Seven values remain unresolved, see below |
| Communications and email (Pass 2A) | `AxisPoint Communications System.dc.html` | Approved. Belongs to a later email/backend pass |
| Letterhead and Management Proposal document (Pass 2B) | `AxisPoint Proposal and Letterhead System.dc.html` | Approved for future use. **Implementation deferred, not required for launch** |

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
| All files | `support.js`, Google Fonts (Figtree, Cormorant Garamond, and seven Noto families for the nine locales) |

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

## QR: seven unresolved values

The QR design is complete and approved. These seven values are unresolved **by design** and are
listed in the board's own §q13. They **block production completion and physical-card cutover.
They do not block frontend implementation.**

1. A verified phone for each partner, or a decision to omit Call
2. Verified email behaviour for each partner, or a decision to route Email to `info@axispoint.llc` with disclosure
3. Whether a firm phone will ever exist
4. The final permanent profile URL — **printed on the physical card and unrevisable after printing**
5. The contact-file generation and delivery method
6. Whether the organization note is set, and its exact wording
7. Whether a mailing address appears anywhere (currently it does not; only "Houston, Texas")

A QR implementation pass may proceed using **configurable local fixture data and simulated
contact-download behaviour.** It must not silently select a permanent public URL or a
production delivery architecture.

**V2 QR has no embedded intake.** "Request a Management Proposal" is a normal link into the
shared website intake. `apps/qr` should not consume `VITE_FORM_ENDPOINT`. Any future vCard
delivery endpoint is a separate, undecided contract.

## Recording future design revisions

A new approved export becomes a new dated folder in the archive. Update this file's version
line, tables, and ledger in the same task, and add a dated line to
[`CHANGELOG.md`](CHANGELOG.md). Never edit an existing export.
