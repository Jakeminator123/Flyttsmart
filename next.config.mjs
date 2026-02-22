/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // Allow D-ID studio iframe and related media/connections
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.d-id.com",
              "style-src 'self' 'unsafe-inline' https://*.d-id.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https:",
              "frame-src 'self' https://studio.d-id.com https://agent.d-id.com https://*.d-id.com",
              "connect-src 'self' https://*.d-id.com wss://*.d-id.com https://api.openai.com https://*.turso.io",
              "media-src 'self' blob: data: https://*.d-id.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
