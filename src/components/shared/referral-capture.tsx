"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/referral";
import { captureVersionFromUrl } from "@/lib/version-link";

// Mounted once in the root layout so a `?ref=` (referral, captured only) or
// `?v=` (NSMQ version to enroll in after sign-in) on any entry URL is kept,
// whichever page the visitor lands on first.
export function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl();
    captureVersionFromUrl();
  }, []);
  return null;
}
