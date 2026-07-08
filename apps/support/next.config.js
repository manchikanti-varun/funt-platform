/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@funt-platform/constants", "@funt-platform/auth-utils"],
};

module.exports = nextConfig;
