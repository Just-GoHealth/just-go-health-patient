"use client";

import { useCallback } from "react";
import { formatCountdown, useCountdown } from "@just-gohealth/ui";
import type { ApiError } from "./http";

/**
 * `429 RATE_LIMITED`: disable the button and count down from `Retry-After`.
 * `trip(error)` starts the countdown and returns true when the error was a
 * rate limit, so callers can skip their other handling.
 */
export function useRateLimit() {
  const { secondsLeft, isRunning, restart } = useCountdown(0);
  const trip = useCallback(
    (error: ApiError | null | undefined): boolean => {
      if (error?.code !== "RATE_LIMITED") return false;
      restart(Math.max(1, error.retryAfter ?? 60));
      return true;
    },
    [restart],
  );
  const limited = isRunning && secondsLeft > 0;
  return {
    limited,
    secondsLeft,
    trip,
    /** "Try again in 0:42" while limited, otherwise null. */
    label: limited ? `Try again in ${formatCountdown(secondsLeft)}` : null,
  };
}
