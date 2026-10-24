import type { NextConfig } from "next";
import { apiRewrites } from "./src/lib/v2/api-paths";

// The backend v2 API is proxied same-origin at the ROOT path (see
// src/lib/v2/api-paths.ts), so the browser only ever talks to 'self'.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://justgo.up.railway.app";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    return apiRewrites(API_BASE_URL);
  },
};

export default nextConfig;
