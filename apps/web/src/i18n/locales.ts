/**
 * The canonical locale registry (design@2026-07-31, language selector).
 *
 * This is the ONLY source of locale data. The approved board is explicit that the
 * cycling animation and the menu derive from the same registry and that "nine locales
 * are never hard-coded into the animation", so there is deliberately no second list
 * anywhere in the codebase.
 *
 * Nothing here translates the site. Still true: no page copy is translated, there is no
 * locale routing, no persistence, and no hreflang.
 *
 * CHANGED IN THE LOCALIZATION READINESS PASS. This registry is now genuinely the only
 * locale list: the intake's duplicate `APPROVED_LANGUAGES` and the mapper's third
 * English-name table are gone, and the follow-up select stores CODES from here. The page
 * locale and the follow-up preference ARE now stored with a submission, as two separate
 * facts, which the earlier version of this comment said they were not.
 */

export type LocaleCode = 'en' | 'es' | 'zh-Hans' | 'zh-Hant' | 'vi' | 'hi' | 'ur' | 'gu' | 'pa';

export type TextDirection = 'ltr' | 'rtl';

/**
 * Translation review is a gate, not a label. A locale reaches production only when a
 * professional pass has been completed and signed off.
 */
export type ReviewStatus = 'reviewed' | 'unreviewed';

export interface Locale {
  code: LocaleCode;
  /** Two-letter display code for the compact mobile trigger. */
  shortCode: string;
  /** The language's own name, shown first in the menu. */
  nativeName: string;
  /** The native word for "Language". This is what the decorative slot cycles. */
  nativeWord: string;
  /** English name, shown second in the menu. */
  englishName: string;
  direction: TextDirection;
  /**
   * Script support stack. These are language-support fonts, not a third brand
   * typeface: Figtree remains the brand utility face and is always the fallback.
   * Simplified and Traditional Chinese use distinct families and are never
   * substituted for one another.
   */
  fontStack: string;
  /** Indic scripts need more leading than Latin at the same size. */
  lineHeight: number;
  review: ReviewStatus;
  /** Explicit launch gate. Only enabled AND reviewed locales reach production. */
  enabled: boolean;
}

const FIGTREE = "'Figtree', system-ui, sans-serif";

/**
 * Order follows the approved nine-language list so the cycle and the menu tell the
 * same story.
 *
 * Every locale except English is `enabled: false` and `review: 'unreviewed'`. That is
 * the honest current state: no professional translation pass has happened, and the
 * approved board requires that unavailable translations are never advertised. The
 * native words below are the design's own proof strings and still need native-reader
 * verification for the CJK and Indic entries before any of them launches.
 */
export const LOCALES: Locale[] = [
  {
    code: 'en',
    shortCode: 'EN',
    nativeName: 'English',
    nativeWord: 'Language',
    englishName: 'English',
    direction: 'ltr',
    fontStack: FIGTREE,
    lineHeight: 1.2,
    review: 'reviewed',
    enabled: true,
  },
  {
    code: 'es',
    shortCode: 'ES',
    nativeName: 'Español',
    nativeWord: 'Idioma',
    englishName: 'Spanish',
    direction: 'ltr',
    fontStack: FIGTREE,
    lineHeight: 1.2,
    review: 'unreviewed',
    enabled: false,
  },
  {
    code: 'zh-Hans',
    shortCode: 'ZH',
    nativeName: '简体中文',
    nativeWord: '语言',
    englishName: 'Simplified Chinese',
    direction: 'ltr',
    fontStack: `'Noto Sans SC', ${FIGTREE}`,
    lineHeight: 1.3,
    review: 'unreviewed',
    enabled: false,
  },
  {
    code: 'zh-Hant',
    shortCode: 'ZH',
    nativeName: '繁體中文',
    nativeWord: '語言',
    englishName: 'Traditional Chinese',
    direction: 'ltr',
    fontStack: `'Noto Sans TC', ${FIGTREE}`,
    lineHeight: 1.3,
    review: 'unreviewed',
    enabled: false,
  },
  {
    code: 'vi',
    shortCode: 'VI',
    nativeName: 'Tiếng Việt',
    nativeWord: 'Ngôn ngữ',
    englishName: 'Vietnamese',
    direction: 'ltr',
    fontStack: FIGTREE,
    lineHeight: 1.3,
    review: 'unreviewed',
    enabled: false,
  },
  {
    code: 'hi',
    shortCode: 'HI',
    nativeName: 'हिन्दी',
    nativeWord: 'भाषा',
    englishName: 'Hindi',
    direction: 'ltr',
    fontStack: `'Noto Sans Devanagari', ${FIGTREE}`,
    lineHeight: 1.55,
    review: 'unreviewed',
    enabled: false,
  },
  {
    code: 'ur',
    shortCode: 'UR',
    nativeName: 'اردو',
    nativeWord: 'زبان',
    englishName: 'Urdu',
    direction: 'rtl',
    fontStack: `'Noto Sans Arabic', ${FIGTREE}`,
    lineHeight: 1.55,
    review: 'unreviewed',
    enabled: false,
  },
  {
    code: 'gu',
    shortCode: 'GU',
    nativeName: 'ગુજરાતી',
    nativeWord: 'ભાષા',
    englishName: 'Gujarati',
    direction: 'ltr',
    fontStack: `'Noto Sans Gujarati', ${FIGTREE}`,
    lineHeight: 1.55,
    review: 'unreviewed',
    enabled: false,
  },
  {
    code: 'pa',
    shortCode: 'PA',
    nativeName: 'ਪੰਜਾਬੀ',
    nativeWord: 'ਭਾਸ਼ਾ',
    englishName: 'Punjabi',
    direction: 'ltr',
    fontStack: `'Noto Sans Gurmukhi', ${FIGTREE}`,
    lineHeight: 1.55,
    review: 'unreviewed',
    enabled: false,
  },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

/** Locales that may appear in production: explicitly enabled AND translation-reviewed. */
export function launchReadyLocales(): Locale[] {
  return LOCALES.filter((l) => l.enabled && l.review === 'reviewed');
}

/**
 * Locales the development preview may show. Same registry, filtered differently: the
 * preview relaxes the launch gate so the approved motion and every script can be
 * reviewed before translation work is done. It is never reachable in production.
 */
export function proofLocales(): Locale[] {
  return LOCALES;
}

export function getLocale(code: string | null | undefined): Locale {
  return LOCALES.find((l) => l.code === code) ?? getDefaultLocale();
}

export function getDefaultLocale(): Locale {
  const en = LOCALES.find((l) => l.code === DEFAULT_LOCALE);
  if (!en) throw new Error('locale registry is missing the default locale');
  return en;
}

/**
 * Resolve a requested locale against what is actually available.
 *
 * An unknown code, or a code that is not launch-ready, falls back to English. The
 * approved rule is that unavailable translations are never advertised.
 */
export function resolveLocale(requested: string | null | undefined, available: Locale[]): Locale {
  const match = available.find((l) => l.code === requested);
  return match ?? getDefaultLocale();
}

/**
 * The trigger only cycles when there is genuinely something to cycle through. With
 * fewer than two available locales it stays static, which is production's state today
 * because English is the only launch-ready locale.
 */
export function shouldCycle(available: Locale[]): boolean {
  return available.length >= 2;
}

/**
 * Script fonts needed by the non-Latin proof locales.
 *
 * Deliberately NOT added to index.html. Production ships English only, so none of
 * these are required and the production font payload is unchanged by this pass. The
 * development preview loads them on demand instead, so reviewing the motion never
 * costs a production byte. When a locale is approved for launch, add just that
 * script's family to the document head and record the weight in the changelog.
 */
export const PREVIEW_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600&family=Noto+Sans+Gujarati:wght@400;500;600&family=Noto+Sans+Gurmukhi:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;500;600&display=swap';
