# Email Signatures — Installation Guide

**Partners:** Zachary Russell (Spark) · Ethaniel Vu (Gmail)
**Last updated:** 2026-08-25

## Files

| File | For |
|---|---|
| `zach-signature.html` | Zachary Russell (Spark) |
| `ethaniel-signature.html` | Ethaniel Vu (Gmail) |
| `../../apps/web/public/images/logo-signature.svg` | Logo image — must be uploaded to the server |

## Step 0 — Upload the logo (one-time, owner action)

Before the mark appears in signatures, upload the SVG to the live server:

1. Locate `apps/web/public/images/logo-signature.svg` in this repository.
2. Via FTP or cPanel File Manager, upload it to `public_html/images/logo-signature.svg` on the axispoint.llc server.
3. Verify: `curl -sI https://axispoint.llc/images/logo-signature.svg` should return `Content-Type: image/svg+xml`.

Until uploaded, the alt text "AxisPoint" appears in place of the mark. The rest of the signature is fully functional before this step.

## Installing in Spark (Zachary)

1. Open `zach-signature.html` in a web browser (double-click the file).
2. Click inside the **Preview** box.
3. Select all: **Cmd+A**.
4. Copy: **Cmd+C**.
5. In Spark: **Spark** menu → **Settings** → **Accounts** → select `zach@axispoint.llc`.
6. Click **Signature**, then click into the signature editor.
7. Paste: **Cmd+V**.
8. Save.

**Alternative (HTML mode):** In Spark's signature settings, switch to **HTML** mode, then copy the raw HTML from the "HTML source" textarea in `zach-signature.html` and paste it directly.

## Installing in Gmail (Ethaniel)

1. Open `ethaniel-signature.html` in a web browser (double-click the file).
2. Click inside the **Preview** box.
3. Select all: **Cmd+A** (Mac) or **Ctrl+A** (Windows).
4. Copy: **Cmd+C** / **Ctrl+C**.
5. In Gmail: click the **gear icon** (top right) → **See all settings**.
6. On the **General** tab, scroll to **Signature** → click **+ Create new**.
7. Name the signature (e.g. "AxisPoint"), then click inside the editor.
8. Paste: **Cmd+V** / **Ctrl+V**.
9. Scroll down and click **Save Changes**.

## Design notes

- Table-based layout with inline styles throughout — same compatibility standard as the transactional email system.
- No flexbox, grid, or CSS custom properties.
- Font stack: `'Figtree', Arial, Helvetica, sans-serif` — Figtree where loaded, Arial as fallback.
- Colors: ink `#1C1628`, teal `#24A5BC`, purple `#38285D`, sub `#5A5270`, hint `#9490A8` — all from `packages/brand/src/colors.ts`.
- Logo: `https://axispoint.llc/images/logo-signature.svg` — the approved mark, fullcolor palette, displayed at 30×40px.
- The purple accent bar is a 2px `<td>` with `background-color:#38285D` rather than `border-left`, which survives the Gmail rich-text paste more reliably.

## If something looks wrong after pasting

- **Logo not showing:** the SVG has not been uploaded yet (see Step 0).
- **Font looks like Arial instead of Figtree:** normal — Figtree is not a system font and does not load inside Gmail or Spark's email renderer. The fallback is correct.
- **Colors or layout broken in Gmail:** try re-copying from the preview box. If Gmail's editor strips the table structure, use Gmail's direct HTML editor (toggle to plain text then back to rich text, or use a browser extension like "Signature Maker" that accepts raw HTML).
- **Signature appears without the logo on mobile:** SVG images are not supported in all mobile email apps. Upload the logo, then test; if the issue persists, replacing the `<img>` src with a PNG version of the same file resolves it.
