# Email Signatures — Installation Guide

**Partners:** Zachary Russell (Spark) · Ethaniel Vu (Gmail)
**Last updated:** 2026-08-27

## Files

| File | For |
|---|---|
| `zach-signature.html` | Zachary Russell — open in browser, select all, copy, paste into Spark |
| `ethaniel-signature.html` | Ethaniel Vu — open in browser, select all, copy, paste into Gmail |

Both files use a two-column table layout: logo left (42×56px), teal vertical divider, content right. All styles are inline. No `<div>`, no flexbox, no grid.

## Live URLs

| Resource | URL | Status |
|---|---|---|
| Logo | `https://axispoint.llc/images/mark-color.png` | Live — 200 OK |
| Zach's vCard | `https://axispoint.llc/contacts/zach.vcf` | Live after deploy |
| Ethaniel's vCard | `https://axispoint.llc/contacts/ethaniel.vcf` | Live after deploy |

No placeholder swap needed. The logo URL is already live. The vCard URLs go live once `apps/web/public/contacts/` is deployed to production.

## Installing in Spark — Zachary Russell

### Rich Text mode (recommended)

1. Open `zach-signature.html` in a web browser (double-click the file).
2. Select all: **Cmd+A**.
3. Copy: **Cmd+C**.
4. In Spark: **Spark** menu > **Settings** > **Accounts** > select `zach@axispoint.llc`.
5. Click **Signature**, then click inside the signature editor.
6. Paste: **Cmd+V**.
7. Click **Save** (or the checkmark).

Verify the signature renders: logo on the left, teal vertical bar, then name, PARTNER label, company, tagline, phone/email, website, address, and "Save my contact" link.

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
7. Paste: **Cmd+V** / **Ctrl+V**. The formatted signature should appear with the logo, teal bar, and contact details.
8. Scroll to the bottom of the Settings page and click **Save Changes**.

Set the new signature as the default for new emails and replies under the "Signature defaults" section on the same tab.

## Design reference

| Property | Value |
|---|---|
| Layout | Two-column: logo (42×56px) · 1px teal divider · content |
| Teal divider | `#24A5BC`, 1px wide |
| Name | 18px, weight 600, `#1C1628` |
| PARTNER label | 10px, weight 700, uppercase, letter-spacing 0.16em, `#24A5BC` |
| Company name | 13px, weight 600, `#1C1628` |
| Tagline | 11px, weight 400, `#6B6577` |
| Phone/email line | 11px, `#24A5BC`, underlined, pipe-separated, on one line |
| Website | 11px, `#24A5BC`, underlined, `https://axispoint.llc` |
| Address | 11px, `#6B6577`, plain text (not a link) |
| Save my contact | 11px, `#24A5BC`, underlined, links to person's `.vcf` URL |
| Font stack | `'Figtree', Arial, Helvetica, sans-serif` |

Figtree will not load inside Gmail's or Spark's email renderer — Arial is the correct fallback and is expected behavior.

## Troubleshooting

- **Logo not showing:** verify `https://axispoint.llc/images/mark-color.png` returns HTTP 200.
- **vCard link 404:** the `contacts/` directory deploys with the next `apps/web` production push. Verify `apps/web/public/contacts/zach.vcf` and `ethaniel.vcf` are present in the repo.
- **Layout broken in Gmail after paste:** Gmail's editor sometimes strips table attributes. Try copying again from a freshly opened browser window.
- **Spark Rich Text paste loses the teal bar:** use Spark HTML mode instead (see above).
