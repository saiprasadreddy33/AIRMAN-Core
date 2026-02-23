"use client";

import { RouteGuard } from "@/components/RouteGuard";
import StudentsPage from "@/pages/StudentsPage";

export default function StudentsRoute() {
  return (
    <RouteGuard allowedRoles={["admin", "instructor"]}>
      <StudentsPage />
    </RouteGuard>
  );
}
