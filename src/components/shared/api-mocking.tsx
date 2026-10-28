"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
const MOCK_ROLES = ["PATIENT"];

// Browser only: MSW has no server build.
const MockStarter = dynamic(() => import("@/mocks/starter"), { ssr: false });

/**
 * With NEXT_PUBLIC_API_MOCKING=enabled (`pnpm dev:mock`), starts the MSW mock
 * API (src/mocks) before anything renders, so the first API call is already
 * answered with fake data. Otherwise renders children straight away, and the
 * mocks are never loaded.
 */
export function ApiMocking({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!MOCKING);
  const onReady = useCallback(() => setReady(true), []);

  if (ready) return children;
  return <MockStarter roles={MOCK_ROLES} onReady={onReady} />;
}
