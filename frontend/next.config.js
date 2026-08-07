/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    // Version y fecha de compilación — se fijan una sola vez, al momento del build
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Proxy /api/* through Next.js so cookies are set on the same origin (avoids cross-port cookie issues)
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
