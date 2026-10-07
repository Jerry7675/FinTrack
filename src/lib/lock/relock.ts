/** Grace period before re-locking after the app enters the background. */
export const BACKGROUND_RELOCK_GRACE_MS = 45_000;

let suppressCount = 0;

export function suppressAppRelock(): void {
  suppressCount += 1;
}

export function resumeAppRelock(): void {
  suppressCount = Math.max(0, suppressCount - 1);
}

export function isRelockSuppressed(): boolean {
  return suppressCount > 0;
}

export async function runWithRelockSuppressed<T>(
  fn: () => Promise<T>
): Promise<T> {
  suppressAppRelock();
  try {
    return await fn();
  } finally {
    resumeAppRelock();
  }
}

export function shouldRelockAfterBackground(elapsedMs: number): boolean {
  return elapsedMs >= BACKGROUND_RELOCK_GRACE_MS;
}
