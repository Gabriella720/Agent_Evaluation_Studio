import type { NextConfig } from "next";

// GitHub Pages project site base path:
// https://gabriella720.github.io/Agent_Evaluation_Studio/
const repo = "Agent_Evaluation_Studio";
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath: isProd ? `/${repo}` : "",
  assetPrefix: isProd ? `/${repo}/` : undefined,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
