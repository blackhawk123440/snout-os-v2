import type { Metadata } from "next";
import { SitterAppShell } from "@/components/layout/SitterAppShell";

export const metadata: Metadata = {
  title: "Sitter Dashboard - Snout OS",
  description: "Mobile-friendly dashboard for pet care sitters",
};

export default function SitterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SitterAppShell>{children}</SitterAppShell>;
}