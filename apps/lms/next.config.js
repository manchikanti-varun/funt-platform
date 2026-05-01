const path = require('path');

const nextConfig = {
  transpilePackages: ['@funt-platform/types', '@funt-platform/constants', 'qrcode.react'],
  // Next 16 uses Turbopack by default. This project also customizes the webpack config,
  // so we explicitly provide an empty turbopack config to avoid the startup failure.
  turbopack: {},
  webpack: (config) => {
    config.resolve.modules = config.resolve.modules || [];
    config.resolve.modules.push(path.resolve(__dirname, '../../node_modules'));
    return config;
  },
};

module.exports = nextConfig;
