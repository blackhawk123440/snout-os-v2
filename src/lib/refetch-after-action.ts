/**
 * Shared helper for refetching data after user actions.
 * Use to avoid duplication when multiple components need post-action refresh.
 */

export type RefetchFn = () => void | Promise<void>;

/**
 * Call refetch after a successful action. Use in mutation handlers.
 */
export async function refetchAfterAction(refetch: RefetchFn): Promise<void> {
  try {
    await refetch();
  } catch {
    // Non-blocking - user already got success feedback
  }
}
