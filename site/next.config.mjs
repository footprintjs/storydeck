import { BASE } from './site.config.js';
import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: BASE,              // served under footprintjs.github.io/storydeck
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  transpilePackages: ['storydeck'],
  webpack: (config, { isServer }) => {
    // storydeck is linked (file:..) and ships its own React; dedupe React in the client bundle only.
    config.resolve.symlinks = false;
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom'),
      };
    }
    return config;
  },
};
export default nextConfig;
