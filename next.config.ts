import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Node.js packages used server-side (tRPC routers, API routes)
  serverExternalPackages: [
    "pdfjs-dist",
    "jszip",
    "fast-xml-parser",
    "mammoth",
    "docx",
  ],

  // Increase body size limit for document uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
