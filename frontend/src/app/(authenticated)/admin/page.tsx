"use client";

import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/components/dashboards/AdminDashboard";

export default function AdminPage() {
  const { user } = useAuth();
  if (!user || user.role !== "admin") return null;
  return <AdminDashboard user={user} />;
}
