/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" produces a self-contained build at .next/standalone/ that
  // works in slim Docker images without copying the full node_modules tree.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fal.media" },
      { protocol: "https", hostname: "**.fal.ai" },
    ],
  },
};

export default nextConfig;
