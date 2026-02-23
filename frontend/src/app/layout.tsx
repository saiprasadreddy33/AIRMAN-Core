import type { Metadata } from "next";
import "@/index.css";
import { ClientProviders } from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "AIRMAN-Core",
  description: "AIRMAN-Core Application",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
