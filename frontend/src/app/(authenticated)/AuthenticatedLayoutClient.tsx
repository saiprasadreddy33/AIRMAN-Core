"use client";

import { RouteGuard } from "@/components/RouteGuard";
import AppLayout from "@/components/AppLayout";

export default function AuthenticatedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard>
      <AppLayout>{children}</AppLayout>
    </RouteGuard>
  );
}
