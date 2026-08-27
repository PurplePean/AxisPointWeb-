# Email Signatures — Installation Guide

**Partners:** Zachary Russell (Spark) · Ethaniel Vu (Gmail)
**Last updated:** 2026-08-26

## Files

| File | For |
|---|---|
| `zach-signature.html` | Zachary Russell — open in browser, select all, copy, paste into Spark |
| `ethaniel-signature.html` | Ethaniel Vu — open in browser, select all, copy, paste into Gmail |

Both files are Option A (left teal rule, single-column stacked content). All styles are inline. No `<div>`, no flexbox, no grid.

## Step 0 — Swap in the logo URL (one-time, before installing)

Both files contain the placeholder `YOUR_HOSTED_LOGO_URL_HERE` as the `src` on the logo `<img>`. Replace it with the real hosted URL before installing. Suggested display size: 90 x 28 px — adjust width/height attributes to match the actual asset dimensions.

**To replace:** open the `.html` file in a text editor, find `YOUR_HOSTED_LOGO_URL_HERE`, and replace it with the full URL (e.g. `https://axispoint.llc/images/logo-signature.png`). Save the file before proceeding to the install steps below.

Until replaced, the alt text "AxisPoint Partners" appears in place of the mark. The rest of the signature renders correctly before this step.

## Installing in Spark — Zachary Russell

### Rich Text mode (recommended)

1. Open `zach-signature.html` in a web browser (double-click the file).
2. Select all: **Cmd+A**.
3. Copy: **Cmd+C**.
4. In Spark: **Spark** menu > **Settings** > **Accounts** > select `zach@axispoint.llc`.
5. Click **Signature**, then click inside the signature editor.
6. Paste: **Cmd+V**.
7. Click **Save** (or the checkmark).

Verify the signature renders: logo (once uploaded), name, teal rule on the left, company info, and contact details.

### HTML mode (alternative)

Use this if the Rich Text paste loses formatting.

1. Open `zach-signature.html` in a browser.
2. View the page source: **View** menu > **Developer** > **View Source**, or press **Cmd+U**.
3. Select all source: **Cmd+A**.
4. Copy: **Cmd+C**.
5. In Spark: **Spark** menu > **Settings** > **Accounts** > select `zach@axispoint.llc`.
6. Click **Signature**, switch to **HTML** mode.
7. Paste the full source: **Cmd+V**.
8. Click **Save**.

## Installing in Gmail — Ethaniel Vu

1. Open `ethaniel-signature.html` in a web browser (double-click the file).
2. Select all: **Cmd+A** (Mac) or **Ctrl+A** (Windows).
3. Copy: **Cmd+C** / **Ctrl+C**.
4. In Gmail: click the **gear icon** (top right) > **See all settings**.
5. On the **General** tab, scroll to **Signature** > click **+ Create new**.
6. Name it (e.g. "AxisPoint Partners"), then click inside the editor box.
7. Paste: **Cmd+V** / **Ctrl+V**. The formatted signature should appear with the teal rule on the left.
8. Scroll to the bottom of the Settings page and click **Save Changes**.

Set the new signature as the default for new emails and replies under the "Signature defaults" section on the same tab.

## Design reference

| Property | Value |
|---|---|
| Layout | Option A: 3px teal left rule, single content column |
| Teal rule | `#24A5BC`, 3px wide |
| Name | 15px bold, `#1C1628` |
| Title | 12px, `#5A5270` |
| Company | 11px semibold, `#1C1628` |
| Tagline / address | 11px, `#9490A8` |
| Email link | `#24A5BC`, no underline |
| Phone link | `#1C1628`, no underline |
| Font stack | `'Figtree', Arial, Helvetica, sans-serif` |
| Hairline rule | 1px, `#E8E4F0` |

Figtree will not load inside Gmail's or Spark's email renderer — Arial is the correct fallback and is expected behavior.

## Troubleshooting

- **Logo not showing:** the URL has not been swapped in yet (see Step 0), or the hosted file has not been uploaded.
- **Layout broken in Gmail after paste:** Gmail's editor sometimes strips table attributes. Try copying again from a freshly opened browser window. If the issue persists, use Gmail's "Insert HTML" approach: compose a new email, switch to plain text and back to rich text, then paste.
- **Spark Rich Text paste loses the teal bar:** use Spark HTML mode instead (see above).
- **Logo appears distorted:** the `width` and `height` attributes in the `<img>` tag are set to 90x28 as an estimate. Edit the file to match your actual logo dimensions.
