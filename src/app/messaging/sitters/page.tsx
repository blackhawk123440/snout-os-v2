import { redirect } from 'next/navigation';

export default function MessagingSittersPage() {
  redirect('/messaging?tab=sitters');
}
