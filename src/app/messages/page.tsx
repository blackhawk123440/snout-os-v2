import { redirect } from 'next/navigation';

export default async function LegacyMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  redirect(`/messaging${queryString ? `?${queryString}` : ''}`);
}
