import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/week-studio",
        destination: "/weekly-plan",
        permanent: true,
      },
      {
        source: "/weekly-studio-2",
        destination: "/weekly-plan",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/api-keys",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
