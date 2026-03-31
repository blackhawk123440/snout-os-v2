import { redirect } from 'next/navigation';

export default function WaitlistPage() {
  redirect('/clients?tab=waitlist');
}
