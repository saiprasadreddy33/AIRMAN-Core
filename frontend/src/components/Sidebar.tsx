"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  Settings,
  LogOut,
  Plane,
  ChevronRight,
  ClipboardList,
  BarChart3,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/types";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

interface SidebarProps {
  onClose?: () => void;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ["admin", "instructor", "student"],
  },
  {
    label: "Courses",
    to: "/courses",
    icon: <BookOpen className="w-4 h-4" />,
    roles: ["admin", "instructor", "student"],
  },
  {
    label: "Schedule",
    to: "/schedule",
    icon: <Calendar className="w-4 h-4" />,
    roles: ["admin", "instructor", "student"],
  },
  {
    label: "Students",
    to: "/students",
    icon: <Users className="w-4 h-4" />,
    roles: ["admin", "instructor"],
  },
  {
    label: "Reports",
    to: "/reports",
    icon: <BarChart3 className="w-4 h-4" />,
    roles: ["admin", "instructor"],
  },
  {
    label: "Audit Logs",
    to: "/audit",
    icon: <ClipboardList className="w-4 h-4" />,
    roles: ["admin"],
  },
  {
    label: "User Management",
    to: "/users",
    icon: <Shield className="w-4 h-4" />,
    roles: ["admin"],
  },
  {
    label: "Settings",
    to: "/settings",
    icon: <Settings className="w-4 h-4" />,
    roles: ["admin", "instructor", "student"],
  },
];

const ROLE_BADGE: Record<UserRole, { label: string; className: string }> = {
  admin: { label: "Admin", className: "badge-destructive" },
  instructor: { label: "Instructor", className: "badge-warning" },
  student: { label: "Student", className: "badge-info" },
};

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const badge = ROLE_BADGE[user.role];

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-sky flex items-center justify-center flex-shrink-0">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-sm leading-tight text-foreground tracking-wide">
              AIRMAN
            </div>
            <div className="text-[10px] text-muted-foreground">
              {user.tenantName}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4 pb-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Navigation
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {visibleItems.map((item) => {
          const currentPath = pathname ?? "";
          const isActive =
            currentPath === item.to || currentPath.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              href={item.to}
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive ? "nav-item-active" : "nav-item"
              }`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/60 mb-2">
          <div className="w-7 h-7 rounded-full gradient-sky flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-foreground">
              {user.name}
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.className} font-medium`}
            >
              {badge.label}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
