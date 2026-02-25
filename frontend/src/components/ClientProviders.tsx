"use client";

import { type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { SessionExpiredModal } from "@/components/SessionExpiredModal";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SessionExpiredModal />
        <AuthProvider>{children}</AuthProvider>
      </TooltipProvider>
    </QueryProvider>
  );
}
