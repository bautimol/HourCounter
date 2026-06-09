import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The avatar uploaders cap files at 5 MB on the client. Server Actions
      // wrap the file in multipart/form-data, which adds overhead (~tens of
      // KB), so we set the body limit a bit above 5 MB to leave headroom.
      bodySizeLimit: "8mb",
    },
  },
  // Security headers. frame-ancestors / X-Frame-Options stop the app from being
  // iframed (clickjacking the clock-in / verify / pay actions). We keep the CSP
  // to frame-ancestors only — a full CSP would need careful work to not break
  // Next.js inline runtime + Tailwind, and clickjacking is the concrete risk here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
