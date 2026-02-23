"use client";

import { RouteGuard } from "@/components/RouteGuard";
import UsersPage from "@/pages/UsersPage";

export default function UsersRoute() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <UsersPage />
    </RouteGuard>
  );
}
