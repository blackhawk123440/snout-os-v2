import { redirect } from 'next/navigation';

export default function BundlesPage() {
  redirect('/settings?section=bundles');
}
