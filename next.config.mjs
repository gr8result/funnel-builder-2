// next.config.mjs
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextConfig = {
  reactStrictMode: false,

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