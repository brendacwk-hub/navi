import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputFileTracingIncludes: {
      '/api/diary/prompts': ['./personal/**/*'],
    },
  } as any,
};

export default nextConfig;
