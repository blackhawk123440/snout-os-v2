import { redirect } from "next/navigation";

/**
 * Legacy tip URL format: /tip/20/john-smith
 * Redirects to the canonical flow: /tip/t/20/john-smith → /tip/payment
 */
export default async function LegacyTipPage({
  params,
}: {
  params: Promise<{ amount: string; sitter: string }>;
}) {
  const { amount, sitter } = await params;
  redirect(`/tip/t/${encodeURIComponent(amount)}/${encodeURIComponent(sitter)}`);
}
