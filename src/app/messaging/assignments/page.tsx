import { redirect } from 'next/navigation';

export default function MessagingAssignmentsPage() {
  redirect('/settings?section=routing');
}
