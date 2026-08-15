# STATUS

The concise state record for the V2 transition. Update it as part of each pass. If a line has
not changed, leave it alone. This replaces re-auditing; it is not a project-management board.

_Last updated: 2026-08-15 (no-deletion verification and documentation safety pass)_

**What is V1, V2, transitional QR, or external is settled in
[`system-classification.md`](system-classification.md), not here.** This file records current
blockers, decisions, and state. Where the two touch the same fact, the classification wins and
this file is what gets corrected.

## Where things stand

| | |
|---|---|
| **Approved design versions** | `design@2026-07-30` (site, intake, QR), `design@2026-07-31` (language selector), `design@2026-08-01` (QR Contact Exchange), `design@2026-08-02` (QR Contact emails and digest). See [`design-sources.md`](design-sources.md) |
| **Current code pass** | **No-deletion verification and documentation safety pass.** CI gaps closed, the stale-documentation cluster corrected, [`system-classification.md`](system-classification.md) brought into the repository, the QR e2e banner restored. Nothing deleted |
| **Completed passes** | Code Pass 1 audit (read-only). Pass 0, workflow reconciliation. Pass 2, shared frontend foundations. Pass 3, public pages and routes. Pass 4, V2 intake frontend. Pass 5, V2 QR frontend. Pass 6, language-selector component. Pass 7, backend contract audit (read-only). Pass 8, backend scaffold and contract. Pass 9A, email system, daily QR digest, retention, and policy reconciliation. Pass 9B, six-tab storage model, partial-write recovery, and one booking rule. Pass 9C, booking eligibility forwarded on the success response. Pass 10A, shared submission client and website-intake connection. Pass 10B, QR Contact Exchange frontend. Pass 10C, booking command connected. **Multilingual Content Rollout, all 5 PRs merged through #78** |
| **Next pass** | V1 retirement, per [`system-classification.md`](system-classification.md). The confirmed V1 list and the abandoned articles residue come out; `apps/qr` and the V1-endpoint rejection guards stay. After that: provision the V2 backend and stand up staging, planned in [`staging-provisioning.md`](staging-provisioning.md). **No endpoint exists and none has been contacted** |

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

## Multilingual Content Rollout (in progress)

**PR 5 of 5 is open and held unmerged for review: locale routing, SEO locale signals, script
font application, and visitor-facing email localization.** PRs 1 through 4 are merged. This is
the last PR of the pass; see "PR 5" below for what it does and for the one hosting fact that
has to be settled before any language can be activated.

**PR 4 is merged: the contact page, intake, validation, submission states, and booking, in all
nine languages.** 108 new keys, taking the catalog to **366**, with all eight audit catalogs at
full 366/366 parity. It was the highest-risk PR of the pass, because visible labels must change
per locale while stored tokens, request meaning, retry identity, and booking instants stay
fixed.

- **A deterministic 20-state English baseline was captured BEFORE any edit** and is committed
  at `apps/web/tests/baseline-intake/`. It covers the gateway, all three proposal steps, both
  short pathways, validation, sending, failed, blocked, both confirmations, the booking
  picker, a selected booking, scheduled, and skipped. `intake-states.mjs` drives a real
  browser because step 2, `blocked`, and the booking selection cannot be reached by URL. It
  **freezes the clock** at 2026-08-11T15:00:00Z, without which the booking candidates would
  make the committed baseline rot within a day. Rendered English is identical across all 20
  states after the migration.
- **Display text and stored values stay separate.** Nothing migrated here is ever stored,
  sent, or used as a lookup key; the wire still carries stable snake_case tokens. The existing
  suite already proved this and still passes: a synthetic catalog changes every visible label
  and leaves the submitted envelope byte-identical, an unmapped label throws rather than being
  sent, and the backend actively rejects a display string.
- **One interpolation helper, seven declared placeholders.** `interpolate` substitutes
  `{name} {email} {count} {day} {time} {mode} {language}` and deliberately leaves an unknown
  token visible rather than blanking it, so a bad translation fails loudly. Tests assert every
  placeholder is declared, that each interpolated key carries the same placeholders in all
  nine locales, and that no locale resolves to a leftover brace.
- **The booking instant is locale-independent while its label is not.** All nine locales
  select the same 11:00 slot and render it as `11:00 AM`, `11:00`, `上午11:00`, or `11:00 am`.
  That difference is the requirement, not a defect.
- **`Select a date` and `Select a time` are now translated `aria-label`s**, so the browser
  review locates the pickers structurally by position rather than by their English text. A
  text-keyed selector would have silently no-opped in eight of nine locales.

**Per-locale intake review artifacts** are committed at `apps/web/tests/preview-intake/`, one
file per locale, 640 lines each, covering sixteen states in reading order.

### PR 5: locale routing, SEO signals, fonts, and visitor email

**The URL is the only source of truth for the page locale.** English is unprefixed
(`/contact`); every other locale is path-prefixed (`/es/contact`). Nothing is written to a
cookie or to `localStorage`, deliberately: a stored locale can disagree with the URL, and then
one of the two has to lose silently. `/en/...` is refused so English keeps one canonical
address rather than two.

**Only `enabled && reviewed` locales produce routes, canonicals, `hreflang`, or sitemap
entries, which today means English alone.** A disabled prefix renders the 404 inside the normal
site chrome. It is never rewritten to the English page: `/es/contact` today is an address that
does not exist, and saying so is the honest answer. Redirecting would publish a URL the launch
gate says is unavailable and would hide the gate from anyone testing it. English is
`x-default`.

**Two routing bugs were found by the committed rendered-English baseline, not by reasoning.**
React Router ranks a dynamic segment above a splat, so `/no-such-page` matched `/:locale` and
rendered the home page; and the refused-locale 404 first rendered with no header, footer, or
skip link. Both are fixed and pinned by tests in `apps/web/tests/route.test.ts`.

**Script fonts now reach page content, which they did not before.** The earlier approach set
`font-family` on `body`, and the browser review showed headings ignoring it: they carry
`font-serif` (Cormorant Garamond), which sets its own family and outranks anything inherited.
Cormorant has no Devanagari, Gujarati, Gurmukhi, Arabic, or CJK glyphs, so those headings were
being drawn by whatever the browser substituted. A `[lang="…"]`-scoped stylesheet now covers
body, headings, and `.font-serif`. It is emitted **only for the six non-Latin locales**;
Spanish and Vietnamese keep the brand serif, because Latin text renders correctly in it and
overriding would discard the brand face to fix nothing.

**One font family loads, and English loads none.** The six-family stylesheet that appears in a
preview session belongs to the language selector and is `import.meta.env.DEV` gated, so it is
statically unreachable in a production build; `verify:bundle` proves it. The English font
payload is unchanged by this pass.

**Visitor emails have audit-candidate translations; nothing else does.** The website
acknowledgement and the booking confirmation have model-generated sets for the eight
unreviewed locales, in `scripts/gas-v2/audit/visitorTemplates.js`. That path is **outside
`src/`**, and `.claspignore` is an allowlist admitting only `appsscript.json` and `src/*.js`,
so those templates are structurally incapable of reaching the deployed Apps Script project.
`realTemplates(extraLocaleSets)` takes its locale sets as an argument and has no production
caller that passes any, and `resolveOutboundLocale` only ever returns a locale in
`LAUNCH_READY_LOCALES` (`['en']`). A visitor who asks for Urdu is **recorded** as wanting Urdu
and **answered in English**, on purpose. Internal partner mail and the QR digest take no locale
parameter at all, so they cannot drift out of English.

Three boundaries are recorded in that file rather than hidden: row **values** (backend token
labels) stay English while row **labels** are translated; translated paragraphs lose the
60-column wrap in the plain-text body only; and the **booking date and time stay in English by
design**, because the instant is produced by the one reviewed `formatInstant` path and is
therefore provably identical in all nine languages. A translated email naming a different hour
is a meeting somebody misses, and that risk is not worth a localized date format before review.

**Hosting prerequisite, unresolved and blocking activation.** Path-prefixed URLs only work if
the host rewrites unknown paths to `index.html`. **This repository contains no rewrite
configuration of any kind** (no `.htaccess`, `_redirects`, `vercel.json`, `netlify.toml`, or
`web.config`), and the frontend deploy target is FTP to Apache `public_html/`. So direct
navigation to a prefixed URL, and a hard refresh on one, are **unproven on the real host**. All
routing evidence in this PR comes from the dev server, where Vite serves the SPA fallback.
In-app navigation is unaffected either way. No rewrite file was invented here, because guessing
at the host's configuration is how a 404 reaches production. **Verifying or configuring the
host rewrite is a prerequisite for activating any non-English locale**, and is owner work, not
a code change. It is deliberately not attempted in this PR.

### PR 4 browser review

189 observations across nine locales and two widths, in the same isolated headless Chrome
(unique profile, unique port, frozen clock, cleanup verified). **Zero console errors, zero
page exceptions, and zero non-font off-origin requests**, confirming no submission, email,
calendar, or external service was contacted; the dev build compiles in no endpoint and the
shared client simulates. No state fell back to English, no unresolved placeholder reached a
screen, Urdu was the only RTL locale, and no locale introduced overflow beyond the documented
3px chrome case.

**PRs 1 and 2 are merged. PR 3 of 5 is open and held unmerged for review.** PR 1 built the
catalog infrastructure and the first 92 keys in all nine languages; PR 2 migrated the site
chrome; PR 3 migrates the five marketing pages. PR 4 does the intake; PR 5 does routing,
`hreflang`, fonts, and the visitor email catalogs.

**The five marketing pages are catalog-driven in all nine languages (PR 3).** Home, Property
Management, Asset Management, Investor Services, and Partners, plus their page titles and
meta descriptions, which live beside their page's copy because a title and a description
*are* that page's copy. **143 new keys, taking the catalog to 258**, and all eight audit
catalogs are at full 258/258 parity.

- **Rendered English is byte-identical** to the committed baseline across all seven routes.
  That is the proof this was a migration and not a rewrite.
- **Shared keys, not duplicated strings.** The service names and "Request a Management
  Proposal" appear on these pages exactly as in the chrome and reuse the existing `nav*`
  keys. `pmRunsAmDirectsTitle` is one key shared by the home page and Asset Management, and
  `partnersSignature` by the home page and Property Management.
- **Proper nouns are not catalogued.** Partner names stay in `PartnersPage.tsx`; `AxisPoint`,
  the email address, and `404` stay in code. Hindi initially transliterated the partner names
  into Devanagari and was corrected: the component renders them in Latin for every locale, so
  a reader would otherwise have seen two spellings of the same person on one page.
- **No structured metadata exists anywhere in the app**, so none was migrated and none was
  invented. When schema is added it is a separate decision.
- **`ContactPage.tsx` is deliberately not in this PR.** It is the intake's shell rather than a
  marketing page, and its copy belongs with the intake in PR 4.

**Per-locale review artifacts now cover everything.** `apps/web/tests/preview/<code>.txt` is
one file per locale, 237 lines each, holding the site chrome once and then all five marketing
pages. A native reader opens one file and reads their whole language in reading order. Only
the `<main>` landmark is taken for the page sections, so the header and footer are not
repeated five times.

### PR 3 browser review

Ninety observations: five pages, nine locales, 390px and 1512px, in the same isolated
headless Chrome over CDP as PR 2 (unique temporary profile, unique debugging port,
`--headless=new`, cleanup limited to the spawned PID and that profile, both verified gone).
21 screenshots kept in the scratchpad rather than committed.

**All assertions passed.** Urdu is the only `dir="rtl"` on every page at both widths and its
header, headings, and body all mirror correctly. `<html lang>` is correct in all 90.
**No page-specific overflow was introduced**: `<main>` overflows by 0px everywhere, and the
only page-level overflow is the documented pre-existing 3px chrome overflow at 390px, which
is present identically in English. Every locale renders a translated `<h1>` on every page, so
no page silently fell back to English. Content volume is plausible per script (English ~2,530
characters on the mobile home page, Chinese ~1,450 as expected for a denser script, the rest
2,480 to 2,820), which is the check that catches a page rendering half its copy. Zero page
exceptions. The only off-origin requests are Google Fonts; **non-font off-origin requests: 0**.

**One new finding, pre-existing and out of scope.** React logs "does not recognize the
`fetchPriority` prop on a DOM element" 18 times. The attribute is set in
`PageParts.tsx:97` and `HomePage.tsx:82`, React 18 does not recognise it (React 19 added
support), and **this PR's diff does not touch either line**. PR 2's review never saw it
because the 404 route has no images. It is a console warning with no user-visible effect;
recorded rather than fixed, since it is not localization work.

**The site chrome is catalog-driven in all nine languages (PR 2).** The header, footer,
shell, 404 page, and the language selector's own assistive labels now render from the
catalog: **23 keys**, taking the total to **115**. The estimate in the pass plan was ~33
because it assumed `PageParts.tsx` and `lib/meta.ts` carried copy. Neither does: `PageParts`
is entirely props, and the per-page titles and descriptions are passed in from the page
components, so they migrate with their pages in PR 3. Nothing was dropped.

- **The header and footer share keys rather than duplicating strings.** The three service
  names and Partners appear in both, and two keys holding identical English is precisely how
  a header and footer stop matching once somebody translates one of them.
- **Assistive labels are copy and are translated.** `aria-label` on the lockup, the primary
  nav, the menu dialog, the close button, and both language-selector controls. A screen-reader
  user hears these instead of seeing the layout, so leaving them English on a translated page
  is worse than leaving a visible string English, not better.
- **One interpolated string exists**, `languageChooseAria`, using a literal `{language}`
  placeholder and a `String.replace` helper. No formatting library and no ICU syntax: one
  placeholder does not justify either.
- **`404` itself is deliberately not a catalog key.** It is an HTTP status code, not copy.
- **Rendered English is byte-identical** to the committed baseline, which is what proves the
  migration was lossless rather than merely compiling.

**Rendered locale previews are committed** at `apps/web/tests/preview/<code>.txt`, one per
locale, generated by `apps/web/tests/render-locale-preview.mjs`. They render the 404 route,
the smallest page containing every chrome surface, with the locale's direction, font stack,
and review status in a header. This is what a native reader should be given: the text as a
visitor meets it, in reading order, rather than a TypeScript file. Unlike the English
baseline these are expected to change whenever a translation is corrected.

**Eight audit-candidate catalogs now exist, and nothing about their status has changed.**
`apps/web/src/i18n/catalogs/audit/` holds Spanish, both Chinese scripts, Vietnamese, Hindi,
Urdu, Gujarati, and Punjabi, each covering all 92 keys. **This text was generated by a
language model and has been read by no speaker of any of these languages.** It is not
approved, not professionally translated, not native-reviewed, and not production-ready. It
exists so a native reader has something concrete to correct and so the machinery can be
exercised. All eight stay `enabled: false` and `review: 'unreviewed'`.

**They cannot reach a visitor, by two independent mechanisms.** The registry flags keep them
out of the selector, out of routing, and out of `hreflang`. Separately, `vite.config.ts`
removes the whole directory from the module graph whenever Vite's `command` is `build`, so no
artifact contains them in any mode. `scripts/test/inspect-bundle.mjs` now walks **every**
emitted file rather than `dist/assets/*.js`, including `.map` sourcemaps and their `sources`
arrays, and two independent negative controls confirm it fails on a planted JavaScript-content
leak and on a planted sourcemap-path leak.

**A pre-existing gap was found and closed.** The bundle gate read only `dist/assets/*.js`
while `sourcemap: true` is set, so a module tree-shaken out of the JavaScript could still ship
its full original source in the adjacent `.map` file and the gate would pass. That was true
before this pass and had never been checked.

**A rendered English baseline is now committed and enforced.** `apps/web/tests/baseline/`
holds the rendered text of all seven routes, and `pnpm verify:baseline` fails on any change.
This is the mechanism that replaces bulk search-and-replace for PRs 2 to 4: the previous
pass's bulk JSX migration was reverted precisely because nothing could prove the English had
not moved. The harness renders through Vite SSR because Node's `--experimental-strip-types`
erases types but does not transform JSX, so the existing test runner cannot render a `.tsx`
component at all (verified on Node v25.3.0: `.ts` loads, `.tsx` fails outright).

### Open questions for the native-reader audit, recorded rather than resolved

These came out of writing the candidates. None is a translation error to fix; each is a
decision somebody has to make, and each is flagged in its catalog's header too.

| Locale | Question |
|---|---|
| Urdu | The registry stacks **Noto Sans Arabic**, which is naskh. Many Urdu readers strongly prefer nastaliq (Noto Nastaliq Urdu). This is a font decision, not a translation one, and it affects readability more than any sentence does |
| Punjabi | Written in **Gurmukhi** here, per the approved design. Pakistani Punjabi readers use Shahmukhi, which is Perso-Arabic and RTL. If that is the intended audience, the script is wrong and correcting sentences will not fix it |
| Hindi, Gujarati, Punjabi | First-person verbs agree with the speaker's gender and the visitor's is unknown. The masculine default is used throughout. A reviewer should pick a neutral construction or accept it |
| Spanish | Formal `usted` throughout. The most likely thing to be wrong for the Houston readership, and it runs through nearly every string |
| Traditional Chinese | Taiwan conventions assumed. Hong Kong readers would expect different vocabulary in several places |
| Vietnamese | `quý vị` throughout. `anh/chị` would read warmer, `ông/bà` more distant |
| All | The language selector announces the active locale's **English** name (`languageChooseAria`), carried forward unchanged from before the migration. The native name may be the better choice, but that changes what a screen reader says and is a behaviour decision rather than a translation correction |
| All | `footerLegal` is legal copy. A native reader is **not sufficient**: a mistranslated disclaimer does not read as broken, it reads as a different promise, and this one needs somebody qualified to confirm the translated sentence carries the same meaning |

**One limit of the English baseline, stated so nobody over-trusts it.** `verify:baseline`
compares rendered **text**, with tags and attributes stripped, so it proves visible copy did
not move and does **not** cover `aria-label` values.

**`pnpm verify:aria` covers the attributes, and covers exactly half of them.** It renders the
real component tree in five locales (English, Spanish, Simplified Chinese, Hindi, Urdu) and
asserts the actual rendered `aria-label` values, including that `{language}` is substituted
rather than announced aloud. Type-checking and the no-orphan-key test are **not** sufficient
for this and were never claimed to be: a negative control that rebinds one label to a
different valid key passes both of them while the screen reader says the wrong thing, and
`verify:aria` catches it. A second control proves it catches an unsubstituted placeholder.

**Three of the six migrated labels cannot be reached by any static render.**
`navMenuDialogAria`, `navCloseMenu`, and `languageListAria` sit inside `{open && (...)}`
branches, and `renderToStaticMarkup` renders initial state, which is closed. `verify:aria`
prints them as uncovered rather than reporting a pass over half the surface. **They are
covered by the browser review below instead.**

### Browser review of PR 2: done

Run in an isolated headless Chrome driven over the DevTools Protocol from Node's built-in
`WebSocket`, against the already-running dev server. No dependency was added. Unique
temporary profile, unique debugging port, `--headless=new`, and cleanup limited to the one
spawned PID and that profile, both verified gone afterwards. Nine locales at 390px and
1512px, 18 observations and 18 screenshots.

**What passed.** Urdu is the only `dir="rtl"` and every other locale is `ltr`.
`<html lang>` matches the selected locale in all nine. The RTL header mirrors correctly at
both widths: lockup right, navigation right to left, action on the far left. Locale
switching applies the catalog in all nine. Footers do not overflow at either width. **Zero
console errors and zero page exceptions across the whole run.** The only off-origin requests
are Google Fonts: Figtree and Cormorant Garamond from `index.html`, plus the six Noto
families, which are requested **only** under the preview gate via `PREVIEW_FONT_HREF`. No
submission endpoint was contacted.

**All three menu-open labels are translated in all nine locales**, confirmed by opening the
menus in a real browser: `languageListAria` at both widths, `navMenuDialogAria` and
`navCloseMenu` at mobile where the menu exists.

### Two findings from the browser review, neither caused by PR 2

**1. The per-locale `fontStack` is never applied to page content.** `locales.ts` defines a
script stack per locale, and the only consumers are three sites inside
`LanguageSelector.tsx`. `LocaleProvider` sets `lang` and `dir` and nothing else. The computed
`font-family` on navigation links is `Figtree, sans-serif` for **every** locale including the
CJK, Indic, and Arabic ones, so translated chrome renders through whatever arbitrary system
font the browser falls back to rather than the specified Noto family. It reads acceptably in
the screenshots, but it is not the approved stack and it is not predictable across machines.
PR 2 did not cause this; it made it visible, because the chrome was English until now.
**Fonts are PR 5's scope and this is recorded for it.**

**2. A pre-existing 3px horizontal overflow at 390px.** The header's right-hand control
cluster ends at x=393 in a 390px viewport, so every page scrolls 3px horizontally on a small
phone. A dedicated probe shows it is **constant and locale-independent**: it is present in
the production-like configuration with English and no preview gate, and it does not vary with
the cycling decorative word, whose slot is a fixed 62px. The first review pass appeared to
flag only three locales, which was measurement timing rather than a locale effect, and that
attribution was wrong. It is not caused by PR 2: rendered English is byte-identical per the
baseline, and PR 2 changed only the source of identical strings plus non-layout `aria`
attributes. **Recommended as a separate small fix, deliberately not made here.**

### Production Readiness items recorded by this pass

- **Sitemap and `robots.txt` do not exist and are not introduced here.** When one is added it
  must derive its entries from `launchReadyLocales()`, so a disabled locale can never be
  advertised or indexed. Head `hreflang` remains in PR 5's scope and is unaffected.
- **A hosting rewrite will be required** before any prefixed locale URL works on a real
  server. PR 5 verifies direct load and reload of a prefixed route against a built site and
  documents what the host needs.

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

> **Superseded by the Multilingual Content Rollout (PRs 1 to 5). Read the bullets below as a
> record of what that pass was handed, not as current state.** The rollout has since migrated
> the marketing pages, the footer, the navigation, and the contact and intake flow; taken the
> catalog to **366 keys**; added eight model-generated audit-candidate catalogs at full parity;
> and implemented locale routing. See "Multilingual Content Rollout" above for what is actually
> true now. Two things in this list have **not** changed and still hold: every non-English entry
> is unreviewed and **native-reader review is still required before any activation**, and QR
> Contact Exchange remains honestly English-only.

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
- ~~**The locale routing decision is explicitly left open** by the owner, and neither routing
  nor persistence is implemented. Because locale state lives above the router, a chosen
  locale **survives normal in-app navigation while the application remains loaded**, and
  **resets on a full reload, a direct load, or a new tab**. `setLocale` is the seam a routing
  decision plugs into when one is made.~~ **Resolved in PR 5 of the rollout, and this bullet now
  states the opposite of the truth.** The URL is the source of truth: English unprefixed,
  non-English path-prefixed, nothing persisted to a cookie or `localStorage`, and a locale
  therefore survives a reload, a direct link, and a new tab.
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
| **V1 GAS backend** | **Retired as a business system.** Historically deployed at production version @28; **not serving current business traffic**. The external Apps Script project is not touched by any repository change. Record: [`archive/deployment-v1.md`](archive/deployment-v1.md) |
| **V2 GAS backend** | **Code exists and is tested; nothing external does.** `scripts/gas-v2` is at status `merged`. No Apps Script project, `.clasp.json`, Sheet, Script Properties, triggers, or deployment |
| **This repository's frontend** | **Has never successfully deployed through GitHub Actions.** The two FTP workflows fail at the FTP step because FTP secrets are not configured |
| **Live public sites** | A separate, older, hand-uploaded build unrelated to this repository's git history |
| **Going live** | A future configuration decision (adding FTP secrets), not a git action. Merging to `main` deploys nothing |

This table previously read "V1 GAS backend: deployed, live and serving the current sites",
alongside a note warning against collapsing it with the frontend's status. The warning was
right; the fact underneath it had gone stale. V1 is retired, the public site is a separate
hand-uploaded build, and **nothing in this repository is serving anybody.**

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
- **Both deploy workflows still pass `VITE_FORM_ENDPOINT` into the build.** That is the V1
  variable name; both apps read `VITE_V2_SUBMISSION_ENDPOINT`. A deploy would therefore
  compile in no endpoint and ship a build that fails closed on every submission. Not urgent,
  because neither workflow has ever succeeded, but it must be corrected in the same change
  that adds the FTP secrets. `ci.yml` was corrected in the 2026-08-15 safety pass; the two
  deploy workflows were deliberately left alone as deployment configuration
- Deleting a live Google Sheet tab is not git-revertible
- **The header overflows its viewport by 3px at 390px**, so every page scrolls horizontally
  on a small phone. Pre-existing, locale-independent, and measured in the PR 2 browser review
- **No script font reaches page content.** A launched non-English locale would render in a
  system fallback rather than its approved Noto family until PR 5 applies `fontStack`

## Rollback anchors

| Anchor | Commit | Meaning |
|---|---|---|
| `v1-stable` | `c237a09` | The historical final V1 state. Where V1 source is read from once it leaves `main` |
| `pre-v2-clean-rebuild` | `d194e7e` | **Created and pushed 2026-07-30.** Annotated, present on `origin`. The baseline immediately before the clean V2 rebuild. Named this way rather than `v1-pre-rebuild` because the baseline already contains early V2 work, so it is not a pure V1 marker |
| `pre-v1-retirement-2026-08-14` | `8a6aef1` | Present on `origin`. **The complete pre-deletion repository state.** The rollback anchor for the V1 retirement pass, and where `packages/brand/src/team.ts` and the full pre-edit `deployment.md` are preserved verbatim |

To roll the frontend back to the pre-rebuild baseline, reset to `pre-v2-clean-rebuild`. Nothing
is deployed from this repository, so a rollback here changes no running system.

The historical partner contact values in `packages/brand/src/team.ts` are preserved by
`pre-v1-retirement-2026-08-14` and are **not** to be copied into current V2 code or a tracked
contact document without direct owner verification. They are historical, not confirmed current.
See [`system-classification.md`](system-classification.md), "Special handling before deletion".
