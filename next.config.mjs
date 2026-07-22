// next.config.mjs
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",

  eslint: {
    ignoreDuringBuilds: false,
  },

  devIndicators: false,

  experimental: {
    middlewareClientMaxBodySize: "80mb",
  },

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

  webpack: (config, { dev, nextRuntime }) => {
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
    const aliases = {
      ...(config.resolve.alias || {}),
      immer: require.resolve("immer"),
    };

    if (dev && nextRuntime !== "edge") {
      aliases["private-next-pages/_app"] = path.join(__dirname, "pages", "_app.js");
      aliases["private-next-pages/_error"] = path.join(__dirname, "pages", "_error.js");
      aliases["private-next-pages/_document"] = path.join(__dirname, "pages", "_document.js");
    }

    config.resolve.alias = {
      ...aliases,
    };
    return config;
  },
};

export default nextConfig;
