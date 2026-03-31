import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings - Snout OS",
  description: "Configure your pet care business settings and integrations",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}