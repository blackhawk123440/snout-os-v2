import { redirect } from 'next/navigation';

export default function TemplatesPage() {
  redirect('/settings?section=templates');
}
