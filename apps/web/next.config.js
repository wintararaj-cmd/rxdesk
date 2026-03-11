/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@rxdesk/shared'],
  images: {
    domains: ['rxdesk-uploads.s3.ap-south-1.amazonaws.com'],
  },
};

module.exports = nextConfig;
