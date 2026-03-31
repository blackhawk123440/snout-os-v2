import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payments - Snout OS",
  description: "Track revenue and payment analytics for your pet care business",
};

export default function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}