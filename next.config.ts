import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || "https://justgo.up.railway.app"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
