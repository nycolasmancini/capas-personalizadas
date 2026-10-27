import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import { BRAND } from "@/lib/brand";
import { archivo, bricolage } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${BRAND.name}. ${BRAND.product}`, template: `%s · ${BRAND.name}.` },
  description: BRAND.tagline,
  appleWebApp: { capable: true, title: `${BRAND.name}.`, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fbf8f3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${archivo.variable}`}>
      <body className="min-h-dvh">
        <ClerkProvider
          localization={ptBR}
          signInUrl="/entrar"
          signInFallbackRedirectUrl="/inicio"
          signUpUrl="/entrar"
          signUpFallbackRedirectUrl="/cadastro"
          appearance={{
            variables: {
              colorPrimary: "#1d3fb0",
              colorForeground: "#16181d",
              colorBackground: "#ffffff",
              borderRadius: "6px",
              fontFamily: "var(--font-bricolage)",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
