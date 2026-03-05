/**
 * Convert a Walrus epoch number to a real Date using on-chain timing data.
 *
 * epochStartMs = firstEpochStartMs + (epoch * epochDurationMs)
 */
export function walrusEpochToDate(
  epoch: number,
  firstEpochStartMs: number,
  epochDurationMs: number,
): Date {
  return new Date(firstEpochStartMs + epoch * epochDurationMs);
}

/**
 * Estimate the date of a historical Sui epoch.
 *
 * Uses the current epoch's start timestamp and epoch duration to extrapolate
 * backwards: approxDate = currentEpochStartMs - (currentEpoch - targetEpoch) * epochDurationMs
 */
export function suiEpochToApproxDate(
  targetEpoch: number,
  currentEpoch: number,
  currentEpochStartMs: number,
  epochDurationMs: number,
): Date {
  const epochDiff = currentEpoch - targetEpoch;
  return new Date(currentEpochStartMs - epochDiff * epochDurationMs);
}

/** Format a date as "Mar 15, 2026" */
export function formatEpochDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
