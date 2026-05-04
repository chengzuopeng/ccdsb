import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // We run `pnpm lint` (eslint flat config) explicitly. Skip the implicit
    // next-build pass to avoid the deprecated `next lint` flow.
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['date-fns'],
  },
};

export default nextConfig;
