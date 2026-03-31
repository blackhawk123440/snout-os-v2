import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clients - Snout OS",
  description: "Manage your pet care clients and their booking history",
};

export default function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}