/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages — transpile their TS source so we can ship without a build step
  transpilePackages: ["@citationrate/llm-client"],
  // Router cache: keep RSC payloads in client memory for `dynamic` seconds
  // so back-button navigation between dashboard pages skips the SSR fetch
  // round-trip. Big perceived-speed win on AVI where most pages are dynamic.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      { hostname: "lh3.googleusercontent.com" },
      { hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://sdbaichatbot.com https://*.sdbaichatbot.com; style-src 'self' 'unsafe-inline' https://sdbaichatbot.com https://*.sdbaichatbot.com; img-src 'self' data: blob: https://*.supabase.co https://sdbaichatbot.com https://*.sdbaichatbot.com; connect-src 'self' https://*.supabase.co https://citationrate-backend-production.up.railway.app https://challenges.cloudflare.com https://raw.githubusercontent.com https://sdbaichatbot.com https://*.sdbaichatbot.com wss://sdbaichatbot.com wss://*.sdbaichatbot.com; frame-src https://challenges.cloudflare.com https://js.stripe.com https://sdbaichatbot.com https://*.sdbaichatbot.com; font-src 'self' data: https://sdbaichatbot.com https://*.sdbaichatbot.com;"
          },
        ],
      },
    ];
  },
};

export default nextConfig;
