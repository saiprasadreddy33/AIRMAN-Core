"use client";

import { useAuth } from "@/contexts/AuthContext";
import InstructorDashboard from "@/components/dashboards/InstructorDashboard";

export default function InstructorPage() {
  const { user } = useAuth();
  if (!user || user.role !== "instructor") return null;
  return <InstructorDashboard user={user} />;
}
