export function normalizeSignInEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

export function shouldInvalidateSessionToken(params: {
  deletedAt: Date | null | undefined;
  passwordChangedAt: Date | null | undefined;
  tokenIssuedAtSec: number | null | undefined;
}): boolean {
  if (params.deletedAt) {
    return true;
  }

  if (!params.passwordChangedAt || !params.tokenIssuedAtSec) {
    return false;
  }

  const changedAtSec = Math.floor(params.passwordChangedAt.getTime() / 1000);
  return changedAtSec > params.tokenIssuedAtSec;
}
