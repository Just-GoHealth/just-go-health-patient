"use client";

import { toast } from "@just-gohealth/ui";

// how long a toast stays up - same on-screen time as the old hand-rolled
// show/fade/hide timers (4.2s before it started fading)
const TOAST_DURATION_MS = 4200;

// thin compatibility wrapper over the shared @just-gohealth/ui toaster
// (mounted once in app/layout.tsx), so call sites keep `showToast(msg)`
export function showToast(msg: string) {
  toast(msg, { duration: TOAST_DURATION_MS });
}

export function useToast() {
  return { showToast };
}
