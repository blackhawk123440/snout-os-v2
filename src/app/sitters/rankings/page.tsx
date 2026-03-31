import { redirect } from 'next/navigation';

export default function SitterRankingsPage() {
  redirect('/sitters?tab=rankings');
}
