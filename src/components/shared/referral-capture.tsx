"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/referral";

// Mounted once in the root layout so a `?ref=` on any entry URL is kept,
// whichever page the visitor lands on first.
export function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return null;
}
