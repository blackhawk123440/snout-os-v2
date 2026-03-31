import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar - Snout OS",
  description: "View and manage your pet care bookings in calendar format",
};

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}