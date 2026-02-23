"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {isMobile ? (
        <>
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <div
            className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center gap-3 px-4 h-14 border-b border-border bg-white flex-shrink-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md gradient-sky flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">A</span>
                </div>
                <span className="font-display font-bold text-sm text-foreground">
                  AIRMAN
                </span>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </>
      ) : (
        <>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </>
      )}
    </div>
  );
}
