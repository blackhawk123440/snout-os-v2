export type RuntimeEnvName = 'staging' | 'prod';

/**
 * Resolve runtime env label for health/debug surfaces.
 * Precedence: ENV_NAME -> NEXT_PUBLIC_ENV -> platform hints -> NODE_ENV.
 */
export function getRuntimeEnvName(): RuntimeEnvName {
  const explicit = (process.env.ENV_NAME || process.env.NEXT_PUBLIC_ENV || '').toLowerCase();
  if (explicit === 'staging') return 'staging';
  if (explicit === 'production' || explicit === 'prod') return 'prod';

  if (process.env.VERCEL_ENV === 'preview') return 'staging';
  const branch = process.env.RENDER_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF;
  if (branch && branch !== 'main' && branch !== 'master') return 'staging';

  return process.env.NODE_ENV === 'production' ? 'prod' : 'staging';
}

export function isRedisRequiredEnv(): boolean {
  const envName = getRuntimeEnvName();
  return envName === 'staging' || envName === 'prod';
}
