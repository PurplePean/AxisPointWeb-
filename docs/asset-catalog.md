# Production photography catalog

Every photograph shipped on the public site, with its source, licence status, and
derivatives. **Owner licence confirmation date: 2026-07-30.**

Originals live only in the read-only design archive
(`design@2026-07-30`, see [`design-sources.md`](design-sources.md)). Only optimized
derivatives are committed. The watermarked studies and the `uploads/` tree are never
committed.

## Slots

### Homepage hero

| | |
|---|---|
| **Route and slot** | `/`, hero. This is the LCP image and is loaded eagerly, never lazily |
| **Source** | Adobe Stock **#158947695** |
| **Licence** | Licensed. Owner confirmed 2026-07-30 |
| **Alt text** | "Lawn and building elevation of a multifamily community at sunset" |
| **Derivatives** | `home-hero-multifamily-lawn-{640,1280,1920,2560}.{avif,webp,jpg}` |
| **Crop** | Native 2.53:1 retained. The desktop hero fills a tall right-hand panel, so the full frame height is used |
| **Focal point** | `44% 54%` desktop, `30% 62%` mobile |

### Property Management band

| | |
|---|---|
| **Route and slot** | `/property-management`, band beneath the hero. Lazy loaded |
| **Source** | Adobe Stock **#196537616** |
| **Licence** | Licensed. Owner confirmed 2026-07-30 |
| **Alt text** | "Aerial view of a Texas multifamily community and adjacent retail center" |
| **Derivatives** | `property-management-aerial-{640,1280,1920,2560}.{avif,webp,jpg}` |
| **Crop** | Pre-cropped to 2:1 around the approved focal point |
| **Focal point** | `50% 70%` desktop, `38% 72%` mobile |

### Asset Management band

| | |
|---|---|
| **Route and slot** | `/asset-management`, band beneath the hero. Lazy loaded |
| **Source** | Adobe Stock **#110458363** |
| **Licence** | Licensed. Owner confirmed 2026-07-30 |
| **Alt text** | "Downtown Houston tower and elevated walkway seen from street level" |
| **Derivatives** | `asset-management-houston-towers-{640,1280,1920,2560}.{avif,webp,jpg}` |
| **Crop** | Pre-cropped to 2:1 around the approved focal point |
| **Focal point** | `50% 42%` desktop, `58% 46%` mobile |

### Investor Services band

| | |
|---|---|
| **Route and slot** | `/investor-services`, band beneath the hero. Lazy loaded |
| **Source** | Juan Nino, via Unsplash |
| **Licence** | Cleared under the Unsplash Licence. Never required Adobe confirmation |
| **Alt text** | "Aerial view of a highway interchange in Houston" |
| **Derivatives** | `investor-services-interchange-{640,1280,1920,2560}.{avif,webp,jpg}` |
| **Crop** | Pre-cropped to 2:1 around the approved focal point |
| **Focal point** | `46% 58%` desktop, `62% 62%` mobile |

## Delivery

Each slot ships AVIF, WebP, and JPEG at four widths, selected by `srcset` and
`sizes`. `width` and `height` are set on every `img` so space is reserved before the
file arrives and the page does not shift. Every photograph except the homepage hero
is lazy loaded.

The band images are pre-cropped to 2:1 because the slots are roughly 400px tall on
desktop and 240px on mobile. Shipping the native 4:3 frame would send about twice
the pixels the slot can ever show. Fine positioning still happens in CSS through
`object-position`, using the approved per-viewport values above.

AVIF and WebP are what current browsers actually receive. The JPEG set is a
last-resort fallback, and its widest variants exceed the archive's per-image weight
guidance; that is accepted because no browser lacking AVIF and WebP is likely to be
on a 2560px display.

## Rules

- No watermarked or not-cleared file is ever committed or published.
- No page states or implies that AxisPoint owns, manages, or represents a depicted
  property.
- No "representative imagery" label appears on the public pages.
- The Partners page has no photograph, and no headshots exist anywhere, per the
  approved sources.
- The Property Management page uses one photograph and no separate retail image. Its
  authoritative source carries unused retail-module render values, which is how the
  design records that the module was considered and dropped.

## Not yet produced

- **Open Graph 1200x630 sharing image.** A later launch deliverable. No `og:image`
  tag is emitted, because referencing a file that does not exist is worse than
  omitting the tag.
