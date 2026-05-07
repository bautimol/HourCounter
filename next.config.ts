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
};

export default nextConfig;
