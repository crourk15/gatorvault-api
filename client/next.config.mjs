/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  distDir: '.next',
  outputFileTracing: false,
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
