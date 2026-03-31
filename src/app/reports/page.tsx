import { redirect } from 'next/navigation';

export default function ReportsPage() {
  redirect('/money?tab=reports');
}
