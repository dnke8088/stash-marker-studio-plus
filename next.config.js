/** @type {import('next').NextConfig} */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  distDir: process.env.BUILD_DIR || '.next',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "**",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    unoptimized: true, // Since we're dealing with local Stash server images
  },
};

export default nextConfig;
