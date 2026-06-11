/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  // Email/auth/draft APIs live in Next.js (app/api). Only proxy legacy Express
  // routes that are not implemented in the App Router.
  async rewrites() {
    return [
      {
        source: '/api/ai/summarize',
        destination: 'http://localhost:3001/api/ai/summarize',
      },
      {
        source: '/api/ai/draft',
        destination: 'http://localhost:3001/api/ai/draft',
      },
      {
        source: '/api/ai/search',
        destination: 'http://localhost:3001/api/ai/search',
      },
      {
        source: '/api/ai/classify',
        destination: 'http://localhost:3001/api/ai/classify',
      },
      {
        source: '/api/ai/index',
        destination: 'http://localhost:3001/api/ai/index',
      },
      {
        source: '/api/status/:path*',
        destination: 'http://localhost:3001/api/status/:path*',
      },
    ]
  },
}

export default nextConfig
