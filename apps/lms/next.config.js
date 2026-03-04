const path = require('path');

const nextConfig = {
  transpilePackages: ['@funt-platform/types', '@funt-platform/constants', 'qrcode.react'],
  webpack: (config) => {
    config.resolve.modules = config.resolve.modules || [];
    config.resolve.modules.push(path.resolve(__dirname, '../../node_modules'));
    return config;
  },
};

module.exports = nextConfig;
