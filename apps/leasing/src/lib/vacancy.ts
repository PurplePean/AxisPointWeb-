export interface VacancyCost {
  /** Monthly base rent for the space (annual / 12). */
  monthlyCost: number;
  /** Base rent cost of a 90-day vacancy (annual * 90 / 365). */
  ninetyDayCost: number;
}

const MAX_INPUT = 10_000_000;

/**
 * Calculates the base rent cost of a vacancy.
 * Performs no I/O and stores no data.
 * Throws RangeError for non-finite, zero, negative, or absurdly large inputs.
 */
export function calcVacancyCost(sqft: number, annualRentPerSqft: number): VacancyCost {
  if (!isFinite(sqft) || !isFinite(annualRentPerSqft)) {
    throw new RangeError('inputs must be finite numbers');
  }
  if (sqft <= 0 || annualRentPerSqft <= 0) {
    throw new RangeError('inputs must be positive');
  }
  if (sqft > MAX_INPUT || annualRentPerSqft > MAX_INPUT) {
    throw new RangeError('inputs are unreasonably large');
  }
  const annualTotal = sqft * annualRentPerSqft;
  return {
    monthlyCost: annualTotal / 12,
    ninetyDayCost: annualTotal * (90 / 365),
  };
}
