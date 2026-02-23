"use client";

import { RouteGuard } from "@/components/RouteGuard";
import ReportsPage from "@/pages/ReportsPage";

export default function ReportsRoute() {
  return (
    <RouteGuard allowedRoles={["admin", "instructor"]}>
      <ReportsPage />
    </RouteGuard>
  );
}
