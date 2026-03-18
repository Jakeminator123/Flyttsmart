/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      {
        source: "/demo",
        destination: "https://new-front-nine.vercel.app/",
        permanent: false,
      },
      {
        source: "/demo/:path*",
        destination: "https://new-front-nine.vercel.app/:path*",
        permanent: false,
      },
      {
        source: "/bigdata",
        destination: "https://full-scraper-dashboard.vercel.app/",
        permanent: false,
      },
      {
        source: "/bigdata/:path*",
        destination: "https://full-scraper-dashboard.vercel.app/:path*",
        permanent: false,
      },
      {
        source: "/addressandring",
        destination: "/adressandring",
        permanent: false,
      },
      {
        source: "/addressandring/:path*",
        destination: "/adressandring/:path*",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.d-id.com https://agent.d-id.com https://vercel.live https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://*.d-id.com https://agent.d-id.com https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https: https://fonts.gstatic.com",
              "frame-src 'self' https://*.d-id.com https://agent.d-id.com https://vercel.live",
              "connect-src 'self' https://*.d-id.com wss://*.d-id.com https://api.d-id.com https://api.openai.com https://*.turso.io https://va.vercel-scripts.com https://*.onrender.com https://*.datadoghq.com https://api-js.mixpanel.com https://*.cognitiveservices.azure.com wss://*.cognitiveservices.azure.com",
              "media-src 'self' blob: data: https://*.d-id.com https://agent.d-id.com",
              "worker-src 'self' blob: https://*.d-id.com",
              "child-src 'self' blob: https://*.d-id.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
