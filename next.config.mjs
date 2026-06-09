/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist ships a worker that we load from /public; nothing special needed here.
  webpack: (config) => {
    // Avoid bundling the optional canvas dependency pulled in by pdfjs in node.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
