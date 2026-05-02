import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  serverExternalPackages: [
    "jszip",
    "fast-xml-parser",
    "mammoth",
    "docx",
  ],
};

export default nextConfig;