"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

const COUNTDOWN_SECONDS = 5;

export function SessionExpiredModal() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const goToLogin = useCallback(() => {
    setVisible(false);
    router.push("/");
  }, [router]);

  // Listen for the custom event dispatched by api.ts
  useEffect(() => {
    const handleExpiry = () => {
      setCountdown(COUNTDOWN_SECONDS);
      setVisible(true);
    };
    window.addEventListener("session-expired", handleExpiry);
    return () => window.removeEventListener("session-expired", handleExpiry);
  }, []);

  // Countdown → auto redirect
  useEffect(() => {
    if (!visible) return;
    if (countdown <= 0) {
      goToLogin();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [visible, countdown, goToLogin]);

  if (!visible) return null;

  return (
    /* Full-screen backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(0,0,0,0.55)" }}
      aria-modal="true"
      role="alertdialog"
      aria-labelledby="session-expired-title"
    >
      {/* Card */}
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">

        {/* Decorative top strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400" />

        {/* Body */}
        <div className="flex flex-col items-center px-8 pb-8 pt-8 text-center">

          {/* Icon ring */}
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-100 dark:bg-red-950 dark:ring-red-900">
            <ShieldAlert className="h-10 w-10 text-red-500" strokeWidth={1.5} />
          </div>

          <h2
            id="session-expired-title"
            className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white"
          >
            Session Expired
          </h2>

          <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
            Your session has ended for security reasons.
          </p>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Please sign in again to continue.
          </p>

          {/* Countdown ring */}
          <div className="mb-6 flex flex-col items-center gap-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <span className="text-xl font-bold text-red-500">{countdown}</span>
            </div>
            <span className="text-xs text-gray-400">Redirecting in {countdown}s…</span>
          </div>

          {/* CTA */}
          <button
            onClick={goToLogin}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-red-600 hover:to-orange-600 hover:shadow-lg active:scale-95"
          >
            Sign In Again
          </button>
        </div>
      </div>
    </div>
  );
}
