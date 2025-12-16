/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Content Security Policy - Restricts resource loading
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Allow scripts from self and inline scripts (needed for Next.js)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Allow styles from self and inline styles
              "style-src 'self' 'unsafe-inline'",
              // Allow images from self, data URIs, and specified domains
              "img-src 'self' data: https: blob:",
              // Allow fonts from self
              "font-src 'self' data:",
              // Allow connections to self, Supabase, and OpenAI (via API routes)
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              // Restrict form submissions to self
              "form-action 'self'",
              // Restrict base URI to self
              "base-uri 'self'",
              // Restrict frame ancestors (prevents clickjacking)
              "frame-ancestors 'none'",
              // Upgrade insecure requests in production
              process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
            ].filter(Boolean).join("; "),
          },
          // Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Referrer policy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // XSS protection (legacy, but still useful)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Permissions policy - restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Strict Transport Security (HTTPS only in production)
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },

  // Disable source maps in production for security
  productionBrowserSourceMaps: false,
};

export default nextConfig;



