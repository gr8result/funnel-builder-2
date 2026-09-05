// next.config.mjs
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextSwcLoaderPath = require.resolve("next/dist/build/webpack/loaders/next-swc-loader");

function pinNextSwcLoader(rule) {
  if (!rule || typeof rule !== "object") return;
  if (rule.loader === "next-swc-loader") {
    rule.loader = nextSwcLoaderPath;
  }
  if (Array.isArray(rule.use)) {
    rule.use.forEach((entry) => {
      if (typeof entry === "string") return;
      pinNextSwcLoader(entry);
    });
  }
  if (Array.isArray(rule.oneOf)) rule.oneOf.forEach(pinNextSwcLoader);
  if (Array.isArray(rule.rules)) rule.rules.forEach(pinNextSwcLoader);
}

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
    const pagesDir = path.resolve(__dirname, "pages");
    const aliases = {
      ...(config.resolve.alias || {}),
      immer: require.resolve("immer"),
      "private-next-pages": pagesDir,
      "private-next-pages/_app": path.resolve(pagesDir, "_app.js"),
      "private-next-pages/_app.js": path.resolve(pagesDir, "_app.js"),
      "private-next-pages/_error": path.resolve(pagesDir, "_error.js"),
      "private-next-pages/_error.js": path.resolve(pagesDir, "_error.js"),
      "private-next-pages/_document": path.resolve(pagesDir, "_document.js"),
      "private-next-pages/_document.js": path.resolve(pagesDir, "_document.js"),
    };
    const loaderAliases = {
      ...(config.resolveLoader?.alias || {}),
      "next-swc-loader": nextSwcLoaderPath,
    };

    config.resolve.alias = {
      ...aliases,
    };
    config.resolveLoader = {
      ...(config.resolveLoader || {}),
      alias: loaderAliases,
    };
    config.module?.rules?.forEach(pinNextSwcLoader);
    return config;
  },
};

export default nextConfig;
