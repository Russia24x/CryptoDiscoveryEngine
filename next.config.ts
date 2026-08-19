import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // SECURITY: TypeScript errors should NOT be ignored in production builds.
  // The previous `ignoreBuildErrors: true` allowed a ReferenceError
  // (inputs is not defined) to reach production silently.
  typescript: {
    ignoreBuildErrors: false,
  },
  // React strict mode catches side-effects in render — important for
  // catching double-renders and effect cleanup issues during development.
  reactStrictMode: true,
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai", "localhost"],
};

export default withNextIntl(nextConfig);
