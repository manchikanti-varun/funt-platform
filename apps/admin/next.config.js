const nextConfig = {
  transpilePackages: ['@funt-platform/types', '@funt-platform/constants'],
  // Keep Next 16 Turbopack happy when a webpack config customization is present elsewhere.
  turbopack: {},
};

module.exports = nextConfig;
