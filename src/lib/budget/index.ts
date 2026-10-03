export type BudgetState = 'none' | 'under' | 'close' | 'at' | 'over';

export interface BudgetStateResult {
  state: BudgetState;
  percentage: number;
  remaining: number;
  label: string;
}

/**
 * Calculate budget state and label from spent and limit.
 * Pure function for testing.
 */
export function calculateBudgetState(
  spentMinor: number,
  limitMinor: number
): BudgetStateResult {
  // Clamp negative spent to zero
  const clampedSpent = Math.max(0, spentMinor);

  // Handle no budget set
  if (limitMinor <= 0) {
    return {
      state: 'none',
      percentage: 0,
      remaining: 0,
      label: 'No budget set',
    };
  }

  const ratio = clampedSpent / limitMinor;
  const percentage = ratio * 100;
  const remaining = limitMinor - clampedSpent;

  // Determine state
  if (ratio > 1) {
    return {
      state: 'over',
      percentage,
      remaining,
      label: 'Over by',
    };
  }

  if (ratio === 1) {
    return {
      state: 'at',
      percentage,
      remaining,
      label: 'At limit',
    };
  }

  if (ratio >= 0.8) {
    return {
      state: 'close',
      percentage,
      remaining,
      label: 'Close to limit',
    };
  }

  return {
    state: 'under',
    percentage,
    remaining,
    label: 'left',
  };
}
