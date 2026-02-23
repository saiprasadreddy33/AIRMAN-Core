"use client";

import { useAuth } from "@/contexts/AuthContext";
import StudentDashboard from "@/components/dashboards/StudentDashboard";

export default function StudentPage() {
  const { user } = useAuth();
  if (!user || user.role !== "student") return null;
  return <StudentDashboard user={user} />;
}
