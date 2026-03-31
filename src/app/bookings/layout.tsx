import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bookings - Snout OS",
  description: "Manage your pet care bookings and sitter assignments",
};

export default function BookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}