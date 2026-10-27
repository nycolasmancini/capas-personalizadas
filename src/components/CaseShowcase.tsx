import { caseOuter, holeD, mockupFrame, mockupUrl, roundRectD, shade } from "@/lib/devices/geometry";
import type { DeviceGeometry, DeviceMockup } from "@/lib/devices/types";
import { caseFont } from "@/lib/fonts";
import { cn } from "./ui";

/** Arte de demonstração desenhada sobre a área de impressão (coordenadas em mm ou proporção 0..1). */
export type ShowcaseArt = {
  /** cor de fundo da capa */
  fill?: string;
  /** imagem de fundo (cobre a capa inteira) */
  background?: string;
  /** enfeite posicionado em proporção da largura/altura */
  sticker?: { url: string; x: number; y: number; w: number; rotate?: number };
  text?: { value: string; font: string; size: number; fill: string; y: number; stroke?: string };
};

type ShowcaseDevice = { id: string; name: string; geometry: DeviceGeometry; mockup: DeviceMockup | null };

/**
 * Capa personalizada de exemplo num aparelho real (foto do mockup) ou no desenho
 * vetorial. Usada na página inicial para mostrar o resultado do produto.
 */
export function CaseShowcase({
  device,
  art,
  color = "#1f2023",
  className,
}: {
  device: ShowcaseDevice;
  art: ShowcaseArt;
  color?: string;
  className?: string;
}) {
  const g = device.geometry;
  const m = device.mockup;
  const f = m ? mockupFrame(g, m) : caseOuter(g);
  const pad = m ? 0 : 2;
  const id = `sc-${device.id}`;
  const clip = [roundRectD(0, 0, g.width, g.height, g.radius), ...g.holes.map(holeD)].join(" ");
  const font = art.text ? caseFont(art.text.font) : null;

  return (
    <svg
      viewBox={`${f.x - pad} ${f.y - pad} ${f.w + pad * 2} ${f.h + pad * 2}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={`Capa personalizada em ${device.name}`}
    >
      <defs>
        <clipPath id={`${id}-clip`} clipPathUnits="userSpaceOnUse">
          <path d={clip} clipRule="evenodd" />
        </clipPath>
      </defs>

      {m ? (
        <image href={mockupUrl(m.background)} x={f.x} y={f.y} width={f.w} height={f.h} preserveAspectRatio="none" />
      ) : (
        <PhoneBody g={g} color={color} id={id} />
      )}

      <g clipPath={`url(#${id}-clip)`}>
        {art.fill && <rect width={g.width} height={g.height} fill={art.fill} />}
        {art.background && (
          <image href={art.background} x={0} y={0} width={g.width} height={g.height} preserveAspectRatio="xMidYMid slice" />
        )}
        {art.sticker && (
          <image
            href={art.sticker.url}
            x={(art.sticker.x - art.sticker.w / 2) * g.width}
            y={art.sticker.y * g.height - (art.sticker.w * g.width) / 2}
            width={art.sticker.w * g.width}
            height={art.sticker.w * g.width}
            transform={art.sticker.rotate ? `rotate(${art.sticker.rotate} ${art.sticker.x * g.width} ${art.sticker.y * g.height})` : undefined}
          />
        )}
        {art.text && font && (
          <text
            x={g.width / 2}
            y={art.text.y * g.height}
            textAnchor="middle"
            fontFamily={font.family}
            fontWeight={font.weight}
            fontSize={art.text.size}
            fill={art.text.fill}
            stroke={art.text.stroke}
            strokeWidth={art.text.stroke ? art.text.size * 0.06 : 0}
            paintOrder="stroke"
          >
            {art.text.value}
          </text>
        )}
      </g>

      {/* a camada "border" do mockup é branca fora da capa (serve só ao editor); aqui fica de fora */}
      {m ? (
        m.overlay && <image href={mockupUrl(m.overlay)} x={f.x} y={f.y} width={f.w} height={f.h} preserveAspectRatio="none" />
      ) : (
        <CaseRim g={g} />
      )}
    </svg>
  );
}

/** Corpo do aparelho (traseira, módulo e lentes) em vetor. */
export function PhoneBody({ g, color, id }: { g: DeviceGeometry; color: string; id: string }) {
  const o = caseOuter(g);
  return (
    <>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shade(color, 0.12)} />
          <stop offset="1" stopColor={shade(color, -0.12)} />
        </linearGradient>
      </defs>
      <path d={roundRectD(o.x, o.y, o.w, o.h, o.r)} fill="#000" opacity="0.08" transform="translate(0.8 1.2)" />
      <path d={roundRectD(0, 0, g.width, g.height, g.radius)} fill={`url(#${id}-b)`} />
      {g.holes.map((h, i) => (
        <path key={i} d={holeD(h)} fill={shade(color, -0.2)} stroke={shade(color, 0.25)} strokeWidth="0.4" />
      ))}
      {g.lenses.map((l, i) =>
        l.kind === "lens" ? (
          <g key={i}>
            <circle cx={l.x} cy={l.y} r={l.d / 2} fill="#16171a" stroke="#4a4c52" strokeWidth={l.d * 0.06} />
            <circle cx={l.x} cy={l.y} r={l.d * 0.24} fill="#2a3550" />
            <circle cx={l.x - l.d * 0.1} cy={l.y - l.d * 0.1} r={l.d * 0.07} fill="#fff" opacity="0.5" />
          </g>
        ) : (
          <circle key={i} cx={l.x} cy={l.y} r={l.d / 2} fill={l.kind === "flash" ? "#f4ecd6" : "#2b2c30"} />
        ),
      )}
    </>
  );
}

/** Aro e contorno da capa transparente, por cima da arte. */
export function CaseRim({ g }: { g: DeviceGeometry }) {
  const o = caseOuter(g);
  return (
    <>
      <path
        d={`${roundRectD(o.x, o.y, o.w, o.h, o.r)} ${roundRectD(0, 0, g.width, g.height, g.radius)}`}
        fill="#eef2f6"
        fillOpacity="0.45"
        fillRule="evenodd"
      />
      <path d={roundRectD(o.x, o.y, o.w, o.h, o.r)} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth={1.4} />
      <path
        d={roundRectD(o.x + 0.4, o.y + 0.4, o.w - 0.8, o.h - 0.8, o.r - 0.4)}
        fill="none"
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="0.3"
      />
      {g.holes.map((h, i) => (
        <path key={i} d={holeD({ ...h, x: h.x - 0.35, y: h.y - 0.35, w: h.w + 0.7, h: h.h + 0.7, r: h.r + 0.35 })} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.6" />
      ))}
    </>
  );
}
