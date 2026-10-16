import { SITE } from './site';

/**
 * LEASING INQUIRIES DO NOT GO THROUGH THE APPS SCRIPT BACKEND.
 *
 * The V2 backend contract (docs/backend-v2-contract.md) has no leasing pathway, and adding
 * one is a contract change plus a manual clasp push and deploy. Until that is decided, the
 * form composes a pre-filled email to the firm inbox, tagged with where the visitor came
 * from. The visitor sends it from their own mail app, so the site never claims a message
 * was delivered when it was not.
 */

export type Role = 'landlord' | 'tenant' | 'bov-rent' | 'bov-sale';

export const ROLES: readonly Role[] = ['landlord', 'tenant', 'bov-rent', 'bov-sale'];

export const ROLE_LABELS: Record<Role, string> = {
  landlord: 'Landlord or owner',
  tenant: 'Tenant looking for space',
  'bov-rent': 'Owner requesting a rent BOV',
  'bov-sale': 'Owner requesting a sale BOV',
};

/** Subject prefix per role, so each kind of inquiry sorts itself in the inbox. */
export const SUBJECT_LABELS: Record<Role, string> = {
  landlord: 'Leasing inquiry (landlord)',
  tenant: 'Leasing inquiry (tenant)',
  'bov-rent': 'Rent BOV request',
  'bov-sale': 'Sale BOV request',
};

export interface InquiryInput {
  role: Role;
  name: string;
  email: string;
  phone: string;
  place: string;
  wantsManagement: boolean;
}

export function parseRole(value: string | null | undefined): Role {
  return ROLES.find((r) => r === value) ?? 'landlord';
}

/** Keeps only the attribution parameters we deliberately accept, trimmed and length-capped. */
export function parseAttribution(search: string): string {
  const params = new URLSearchParams(search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'src'];
  const parts: string[] = [];
  for (const key of keys) {
    const v = params.get(key)?.trim().slice(0, 80);
    if (v) parts.push(`${key}=${v}`);
  }
  return parts.join(', ');
}

export function buildInquiryMailto(input: InquiryInput, attribution = ''): string {
  const roleLabel = ROLE_LABELS[input.role];
  const placeLabel = input.role === 'tenant' ? 'Area or space needed' : 'Property address';
  const lines = [
    `I am a: ${roleLabel}`,
    `Name: ${input.name.trim()}`,
    `Email: ${input.email.trim()}`,
    `Phone: ${input.phone.trim() || 'not provided'}`,
    `${placeLabel}: ${input.place.trim() || 'not provided'}`,
    `Also interested in property management: ${input.wantsManagement ? 'yes' : 'no'}`,
    '',
    `Source: leasing.axispoint.llc${attribution ? ` (${attribution})` : ''}`,
  ];
  const subject = `${SUBJECT_LABELS[input.role]} from ${input.name.trim() || 'website'}`;
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
