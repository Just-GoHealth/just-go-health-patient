"use client";

import { useEffect } from "react";
import { startMocking } from "./start.js";

let started = false;

/**
 * Starts the mock API once, then calls `onReady`. Loaded with
 * `next/dynamic` and `ssr: false`, so MSW never reaches the server bundle.
 */
export default function MockStarter({ roles, onReady }) {
  useEffect(() => {
    if (started) return;
    started = true;
    startMocking({ roles })
      .catch((error) => console.error("[mock api] failed to start", error))
      .finally(onReady);
  }, [roles, onReady]);
  return null;
}
