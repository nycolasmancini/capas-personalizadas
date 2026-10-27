import { ImageResponse } from "next/og";

// Ícone de "Adicionar à tela inicial" no iPhone (PNG; o iOS ignora SVG).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d3fb0",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 512 512">
          <rect x="166" y="86" width="180" height="340" rx="40" fill="none" stroke="#fff" strokeWidth="22" />
          <rect x="196" y="118" width="62" height="62" rx="18" fill="#fff" />
          <circle cx="346" cy="398" r="26" fill="#f6c9d6" />
        </svg>
      </div>
    ),
    size,
  );
}
