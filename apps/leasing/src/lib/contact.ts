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

export type Role = 'landlord' | 'tenant';

export const ROLE_LABELS: Record<Role, string> = {
  landlord: 'Landlord or owner',
  tenant: 'Tenant looking for space',
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
  return value === 'tenant' ? 'tenant' : 'landlord';
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
  const placeLabel = input.role === 'landlord' ? 'Property address' : 'Area or space needed';
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
  const subject = `Leasing inquiry (${input.role === 'landlord' ? 'landlord' : 'tenant'}) from ${input.name.trim() || 'website'}`;
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
