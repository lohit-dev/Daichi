// ---------------------------------------------------------------------------
// Anikoto — shared error types
// ---------------------------------------------------------------------------

export class RateLimitedError extends Error {
  constructor(
    public readonly provider: string,
    public readonly retryAfter: number
  ) {
    super(`${provider} rate limited, retry after ${retryAfter}s`);
    this.name = 'RateLimitedError';
  }
}

export function friendlyError(error: unknown): string {
  if (error instanceof RateLimitedError) {
    return `The catalog is busy. Please try again in ${error.retryAfter} seconds.`;
  }
  if (error instanceof Error && error.message.toLowerCase().includes('no playable sources')) {
    return 'No playable source was found for this episode. Try again in a moment.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
