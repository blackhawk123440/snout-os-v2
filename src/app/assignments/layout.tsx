/**
 * Server-side route protection for Assignments page
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AssignmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login?callbackUrl=/assignments');
  }

  // Check if user is owner (not a sitter)
  const user = session.user as any;
  if (user.sitterId) {
    // User is a sitter - redirect to sitter inbox
    redirect('/sitter/inbox');
  }

  return <>{children}</>;
}
