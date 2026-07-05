/**
 * Shared TypeScript Types
 * Used across web and QR apps
 */

/**
 * Article metadata from markdown frontmatter
 */
export interface ArticleMeta {
  slug: string;
  title: string;
  excerpt: string;
  author: 'zach' | 'ethaniel';
  authorInitials: 'ZR' | 'EV';
  date: string; // ISO date string
  category: 'Investors' | 'Advisors' | 'Market';
  type: 'Article' | 'Guide' | 'Publication';
  readTime: number; // Minutes
  published: boolean;
}

/**
 * Parsed article with content
 */
export interface ParsedArticle {
  meta: ArticleMeta;
  html: string;
}

/**
 * Contact form role types
 */
export type ContactRole =
  | 'investor'
  | 'referral'
  | 'pro'
  | 'existing_asset_owner'
  | 'submit_referral';

/**
 * Asset class options
 * CRITICAL: No NNN or Net Lease
 */
export type AssetClass =
  | 'Multifamily'
  | 'Industrial'
  | 'Retail'
  | 'Office'
  | 'Mixed-Use'
  | 'Self-Storage'
  | 'Show me what fits';

/**
 * Newsletter preference types
 */
export type NewsletterPreference = 'articles' | 'opportunities' | 'firm';

/**
 * Meeting type for calendar booking
 */
export type MeetingType = 'meet' | 'phone';

/**
 * Complete contact form data structure
 */
export interface ContactFormData {
  // Step 1: Role selection
  role: ContactRole | null;

  // Step 2: Qualification data (varies by role)
  qualData: Record<string, any>;

  // Step 4: Contact information
  person: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
  };

  // Step 5: Newsletter preferences
  preferences: NewsletterPreference[];

  // Step 6: Booking information (if selected)
  booking: {
    date: string; // YYYY-MM-DD format
    time: string; // H:MM AM/PM format
    meetType: MeetingType;
    phone?: string; // Required if meetType is 'phone'
  } | null;

  // Additional fields
  message: string;
  source: string; // How did you hear about us
  timestamp: string; // ISO timestamp

  // For referral path only
  referred?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    notes?: string;
  };
}

/**
 * Form submission payload
 */
export interface FormSubmissionPayload extends ContactFormData {
  source: 'main-site' | 'qr'; // App source
}

/**
 * Form submission response
 */
export interface FormSubmissionResponse {
  success: boolean;
  submissionId?: string;
  error?: string;
}

/**
 * Newsletter subscription data
 */
export interface NewsletterSubscription {
  email: string;
  firstName?: string;
  preferences?: NewsletterPreference[];
  timestamp: string;
}
