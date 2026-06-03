// next.config.mjs
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextConfig = {
  reactStrictMode: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",

  eslint: {
    ignoreDuringBuilds: true,
  },

  devIndicators: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [];
  },

  // opt into Turbopack explicitly
  turbopack: {},

  webpack: (config) => {
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "C:\\hiberfil.sys",
        "C:\\pagefile.sys",
        "C:\\swapfile.sys",
        "C:\\DumpStack.log.tmp",
      ],
    };

    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      immer: require.resolve("immer"),
    };
    return config;
  },
};

export default nextConfig;