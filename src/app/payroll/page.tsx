import { redirect } from 'next/navigation';

export default function PayrollPage() {
  redirect('/money?tab=payroll');
}
