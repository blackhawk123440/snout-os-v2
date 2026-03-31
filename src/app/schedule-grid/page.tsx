import { redirect } from 'next/navigation';

export default function ScheduleGridPage() {
  redirect('/bookings?view=calendar');
}
