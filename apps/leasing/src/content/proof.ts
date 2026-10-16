/**
 * Proof points shown on the leasing site, kept in one place so the same figure
 * never differs between pages.
 *
 * UNCONFIRMED: The figure was supplied by the owner. What it covers (AxisPoint
 * total vs Ethaniel's book, retail only or all property types) and its as-of
 * date still need confirmation before launch. See the launch checklist in
 * docs/deployment.md.
 */

// UNCONFIRMED: scope of this figure.
// TODO: add an as-of date once confirmed.
export const MANAGED_SQFT = 100000;

// Set to false to hide every proof stat from the site in one place.
export const SHOW_PROOF = true;

export function formatManagedSqft(): string {
  return MANAGED_SQFT.toLocaleString('en-US') + ' sq ft managed';
}

/**
 * Returns the text of the managed square footage stat, or null when proof
 * stats are switched off. Components render nothing for null.
 */
export function managedStatText(show: boolean = SHOW_PROOF): string | null {
  return show ? formatManagedSqft() : null;
}

/**
 * Returns the stat split into a large figure and a small label, or null when
 * proof stats are switched off.
 */
export function managedStatParts(
  show: boolean = SHOW_PROOF,
): { value: string; label: string } | null {
  return show ? { value: MANAGED_SQFT.toLocaleString('en-US'), label: 'sq ft managed' } : null;
}
