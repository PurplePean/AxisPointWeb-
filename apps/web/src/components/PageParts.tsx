import { LocaleLink } from '../components/LocaleLink';

/**
 * Shared building blocks for the approved V2 public pages (design@2026-07-30).
 *
 * These are the pieces `AxisPointPage.dc.html`, `AxisPoint Property Management.dc.html`,
 * and `AxisPoint System Studies.dc.html` all repeat: the page gutters, the 1240px
 * measure, the photograph band, the service-page hero, and the dark closing band.
 * Sizes and colours come from those sources, not from invention.
 *
 * Gutters are 20px mobile and 72px desktop, per the approved sources. 40px is used
 * between them at the tablet width, where the sources define no composition.
 */

export const GUTTER = 'px-5 md:px-10 lg:px-[72px]';
export const MEASURE = 'max-w-v2';
/* Approved section rhythm: ~100px desktop, ~54px mobile. */
export const SECTION = 'py-[54px] lg:py-[100px]';

export function Eyebrow({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`font-bold uppercase ${className}`}
      style={{ fontSize: 11.5, letterSpacing: '0.14em', ...style }}
    >
      {children}
    </div>
  );
}

export interface PhotoSource {
  /** Basename of the derivative set in /images/photos, without width or extension. */
  base: string;
  alt: string;
  /** Intrinsic dimensions of the largest derivative, for aspect-ratio reservation. */
  width: number;
  height: number;
}

/**
 * A full-width photograph band.
 *
 * AVIF first, WebP second, JPEG fallback, each with a width-based `srcset`. The
 * band height and `object-position` come from the approved source per viewport, so
 * the focal point holds at 1512, 834, and 390. `width` and `height` are set on the
 * img so the space is reserved before the file arrives and the page does not shift.
 */
export function PhotoBand({
  photo,
  heightClass,
  focal,
  focalMobile,
  priority = false,
}: {
  photo: PhotoSource;
  /** Approved band height, e.g. "h-[240px] lg:h-[400px]". */
  heightClass: string;
  /** Desktop object-position, e.g. "50% 70%". */
  focal: string;
  /** Mobile object-position. Falls back to the desktop value. */
  focalMobile?: string;
  priority?: boolean;
}) {
  const widths = [640, 1280, 1920, 2560];
  const srcset = (ext: string) =>
    widths.map((w) => `/images/photos/${photo.base}-${w}.${ext} ${w}w`).join(', ');

  return (
    <div className={`relative overflow-hidden ${heightClass}`}>
      {/* The mobile focal point is applied by a media query so the approved value
          for each viewport is used rather than one compromise position. */}
      <style>{`
        .band-${photo.base} { object-position: ${focalMobile ?? focal}; }
        @media (min-width: 1024px) { .band-${photo.base} { object-position: ${focal}; } }
      `}</style>
      <picture>
        <source type="image/avif" srcSet={srcset('avif')} sizes="100vw" />
        <source type="image/webp" srcSet={srcset('webp')} sizes="100vw" />
        <img
          src={`/images/photos/${photo.base}-1280.jpg`}
          srcSet={srcset('jpg')}
          sizes="100vw"
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          className={`band-${photo.base} block w-full h-full object-cover`}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          {...(priority ? { fetchPriority: 'high' as const } : {})}
        />
      </picture>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #F6F2EA 0%, rgba(246,242,234,0.38) 24%, rgba(246,242,234,0.12) 58%, rgba(246,242,234,0.9) 100%)',
        }}
      />
    </div>
  );
}

/** The service-page hero: eyebrow, h1, and the answer paragraph. */
export function ServiceHero({
  eyebrow,
  eyebrowColor,
  title,
  answer,
}: {
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  answer: string;
}) {
  return (
    <section
      className={`${GUTTER} pt-11 lg:pt-[84px] pb-10 lg:pb-16 border-b border-[rgba(28,22,40,0.12)]`}
    >
      <div className={MEASURE}>
        <Eyebrow style={{ color: eyebrowColor, marginBottom: 18 }}>{eyebrow}</Eyebrow>
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-20 items-end">
          <h1
            className="m-0 font-semibold"
            style={{ fontSize: 'clamp(36px, 4.2vw, 58px)', letterSpacing: '-0.045em', lineHeight: 1, textWrap: 'pretty' }}
          >
            {title}
          </h1>
          <p
            className="m-0 text-[rgba(28,22,40,0.7)]"
            style={{ fontSize: 'clamp(17px, 1.3vw, 19px)', lineHeight: 1.5, maxWidth: '42ch', textWrap: 'pretty' }}
          >
            {answer}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * The dark closing band. Present on every approved page except Contact, which ends
 * with the intake itself.
 */
export function ClosingCta({
  title,
  body,
  ctaLabel,
  ctaTo,
  signature,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  signature?: string;
}) {
  return (
    <section className={`${GUTTER} ${SECTION} bg-v2-ink text-white`}>
      <div className={`${MEASURE} grid lg:grid-cols-[1fr_auto] gap-6 lg:gap-20 items-end`}>
        <div>
          <h2
            className="m-0 font-serif"
            style={{ fontSize: 'clamp(35px, 4vw, 58px)', fontWeight: 500, lineHeight: 1.04, textWrap: 'pretty', maxWidth: '17ch' }}
          >
            {title}
          </h2>
          <p
            className="mt-[22px] mb-0 text-[rgba(255,255,255,0.66)]"
            style={{ fontSize: 'clamp(15.5px, 1.2vw, 16.5px)', lineHeight: 1.65, maxWidth: '50ch' }}
          >
            {body}
          </p>
          {signature && (
            <p className="mt-[26px] mb-0 font-semibold text-[rgba(255,255,255,0.85)]" style={{ fontSize: 14 }}>
              {signature}
            </p>
          )}
        </div>
        <LocaleLink
          to={ctaTo}
          className="inline-flex items-center justify-center gap-2.5 rounded-v2 bg-v2-teal font-bold text-v2-action-label justify-self-start transition-colors hover:bg-white"
          style={{ minHeight: 56, padding: '0 26px', fontSize: 15 }}
        >
          {ctaLabel} <span aria-hidden="true" style={{ fontSize: 16 }}>&#8594;</span>
        </LocaleLink>
      </div>
    </section>
  );
}

/** Inline text link with the approved hairline underline. */
export function QuietLink({
  to,
  children,
  className = '',
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <LocaleLink
      to={to}
      className={`inline-flex items-center gap-2 font-semibold border-b border-[rgba(28,22,40,0.35)] rounded-v2 hover:text-v2-teal-support ${className}`}
      style={{ fontSize: 15, paddingBottom: 3, minHeight: 44 }}
    >
      {children} <span aria-hidden="true">&#8594;</span>
    </LocaleLink>
  );
}
