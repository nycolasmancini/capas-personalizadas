import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App interno com login: todas as páginas são dinâmicas
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    // miniaturas dos mockups: o original tem 280×560 px, a tela mostra ~60 px de largura
    localPatterns: [{ pathname: "/mockups/**", search: "" }],
    formats: ["image/webp"],
    minimumCacheTTL: 2678400,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
