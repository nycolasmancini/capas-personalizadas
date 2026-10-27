import {
  Allura,
  Archivo_Black,
  Bebas_Neue,
  Bricolage_Grotesque,
  Caveat,
  Cormorant_Garamond,
  Dancing_Script,
  Great_Vibes,
  Lobster,
  Montserrat,
  Pacifico,
  Permanent_Marker,
  Playfair_Display,
  Satisfy,
} from "next/font/google";

// Fontes da interface
export const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
export const archivo = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo" });

// Fontes disponíveis para os textos da capa
const allura = Allura({ subsets: ["latin"], weight: "400", preload: false });
const caveat = Caveat({ subsets: ["latin"], weight: "700", preload: false });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: "600", preload: false });
const dancing = Dancing_Script({ subsets: ["latin"], weight: "700", preload: false });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", preload: false });
const lobster = Lobster({ subsets: ["latin"], weight: "400", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: "800", preload: false });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", preload: false });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], weight: "700", preload: false });
const satisfy = Satisfy({ subsets: ["latin"], weight: "400", preload: false });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", preload: false });

export const CASE_FONTS = [
  { key: "allura", label: "Allura", family: allura.style.fontFamily, weight: 400 },
  { key: "great-vibes", label: "Great Vibes", family: greatVibes.style.fontFamily, weight: 400 },
  { key: "dancing", label: "Dancing", family: dancing.style.fontFamily, weight: 700 },
  { key: "satisfy", label: "Satisfy", family: satisfy.style.fontFamily, weight: 400 },
  { key: "pacifico", label: "Pacifico", family: pacifico.style.fontFamily, weight: 400 },
  { key: "lobster", label: "Lobster", family: lobster.style.fontFamily, weight: 400 },
  { key: "caveat", label: "Caveat", family: caveat.style.fontFamily, weight: 700 },
  { key: "marker", label: "Marker", family: marker.style.fontFamily, weight: 400 },
  { key: "playfair", label: "Playfair", family: playfair.style.fontFamily, weight: 700 },
  { key: "cormorant", label: "Cormorant", family: cormorant.style.fontFamily, weight: 600 },
  { key: "montserrat", label: "Montserrat", family: montserrat.style.fontFamily, weight: 800 },
  { key: "bebas", label: "Bebas", family: bebas.style.fontFamily, weight: 400 },
  { key: "archivo", label: "Archivo", family: archivo.style.fontFamily, weight: 400 },
  { key: "bricolage", label: "Bricolage", family: bricolage.style.fontFamily, weight: 700 },
] as const;

export function caseFont(key: string) {
  return CASE_FONTS.find((f) => f.key === key) ?? CASE_FONTS[0];
}

/** Garante que todas as fontes de capa foram baixadas antes de desenhar no canvas */
export async function loadCaseFonts() {
  await Promise.all(
    CASE_FONTS.map((f) => document.fonts.load(`${f.weight} 40px ${f.family}`).catch(() => [])),
  );
}
