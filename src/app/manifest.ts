import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Permite "Adicionar à tela inicial" no celular do lojista.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name}. ${BRAND.product}`,
    short_name: `${BRAND.name}.`,
    description: BRAND.tagline,
    start_url: "/inicio",
    display: "standalone",
    background_color: "#fbf8f3",
    theme_color: "#fbf8f3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
