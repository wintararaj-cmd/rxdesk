const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@rxdesk/shared'],
  images: {
    domains: ['rxdesk-uploads.s3.ap-south-1.amazonaws.com'],
  },
};

module.exports = withPWA(nextConfig);
