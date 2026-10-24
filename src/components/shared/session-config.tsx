"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { configureHttp, ensureCsrf } from "@/lib/v2/http";

// pages that assume a session - only these get sent to sign-in when the
// session can't be refreshed. "/" and /onboard handle 401 themselves.
const SIGNED_IN_PAGES = ["/home", "/screening"];

// Mounted once in the root layout: sets the XSRF-TOKEN cookie on start-up and
// tells the v2 client where to go when the session is over.
export function SessionConfig() {
  const router = useRouter();
  useEffect(() => {
    configureHttp({
      onSessionExpired: () => {
        const path = window.location.pathname;
        if (SIGNED_IN_PAGES.some((p) => path.startsWith(p))) {
          router.replace("/onboard");
        }
      },
    });
    ensureCsrf().catch(() => {
      // retried lazily before the first unsafe request
    });
  }, [router]);
  return null;
}
