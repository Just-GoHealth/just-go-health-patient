/**
 * Backend v2 path prefixes this app proxies at the ROOT of its own origin, unchanged.
 * Root, not `/api/...`: the refresh cookie is `Path=/auth`, so `/auth/*` must be
 * same-origin at that exact path, and SameSite=Lax cookies only flow same-site.
 * Keep this list free of the app's own page routes. `/versions` is a page here, so
 * only `/versions/<code>/...` (one or more segments) is proxied.
 */
export const API_PROXY_PREFIXES = [
  "auth",
  "me",
  "patients",
  "campuses",
  "campus-types",
] as const;

export function apiRewrites(apiBaseUrl: string) {
  const base = apiBaseUrl.replace(/\/+$/, "");
  return [
    ...API_PROXY_PREFIXES.flatMap((prefix) => [
      { source: `/${prefix}`, destination: `${base}/${prefix}` },
      { source: `/${prefix}/:path*`, destination: `${base}/${prefix}/:path*` },
    ]),
    // /versions/<code>, /versions/<code>/campuses — not the /versions page itself.
    { source: "/versions/:path+", destination: `${base}/versions/:path+` },
  ];
}
