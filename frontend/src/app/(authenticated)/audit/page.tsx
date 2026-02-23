"use client";

import { RouteGuard } from "@/components/RouteGuard";
import AuditPage from "@/pages/AuditPage";

export default function AuditRoute() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AuditPage />
    </RouteGuard>
  );
}
