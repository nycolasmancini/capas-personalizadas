import Image from "next/image";
import { caseOuter, holeD, mockupFrame, mockupUrl, roundRectD, shade } from "@/lib/devices/geometry";
import type { DeviceGeometry, DeviceMockup } from "@/lib/devices/types";
import { cn } from "./ui";

function PrintArea({ g }: { g: DeviceGeometry }) {
  return (
    <path
      d={[roundRectD(0, 0, g.width, g.height, g.radius), ...g.holes.map(holeD)].join(" ")}
      fill="#1d3fb0"
      fillOpacity="0.12"
      fillRule="evenodd"
      stroke="#ff00ff"
      strokeWidth="0.35"
      strokeDasharray="1.2 0.8"
    />
  );
}

/** Foto do aparelho; com `showPrintArea`, sobrepõe a geometria para conferir o alinhamento. */
function MockupView({
  g,
  m,
  className,
  showPrintArea,
}: {
  g: DeviceGeometry;
  m: DeviceMockup;
  className?: string;
  showPrintArea: boolean;
}) {
  if (!showPrintArea) {
    return (
      <Image
        src={mockupUrl(m.background)}
        alt=""
        width={m.frame.w}
        height={m.frame.h}
        sizes="64px"
        className={cn("w-auto mix-blend-multiply", className)}
      />
    );
  }
  const f = mockupFrame(g, m);
  return (
    <svg viewBox={`${f.x} ${f.y} ${f.w} ${f.h}`} className={className} aria-hidden>
      <image href={mockupUrl(m.background)} x={f.x} y={f.y} width={f.w} height={f.h} preserveAspectRatio="none" />
      <PrintArea g={g} />
    </svg>
  );
}

/** Desenho vetorial leve do aparelho com capa transparente (sem arte), ou a foto do mockup. */
export function DeviceSvg({
  g,
  mockup,
  color = "#1f2023",
  className,
  showPrintArea = false,
}: {
  g: DeviceGeometry;
  mockup?: DeviceMockup | null;
  color?: string;
  className?: string;
  showPrintArea?: boolean;
}) {
  if (mockup) return <MockupView g={g} m={mockup} className={className} showPrintArea={showPrintArea} />;
  const o = caseOuter(g);
  const pad = 2;
  const id = `d${Math.round(g.width * 10)}${Math.round(g.height * 10)}${g.holes.length}`;
  return (
    <svg
      viewBox={`${o.x - pad} ${o.y - pad} ${o.w + pad * 2} ${o.h + pad * 2}`}
      className={className}
      aria-hidden
    >
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
      {showPrintArea && <PrintArea g={g} />}
      <path
        d={roundRectD(o.x, o.y, o.w, o.h, o.r)}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.75"
        strokeWidth={1.6}
      />
      <path d={roundRectD(o.x + 0.4, o.y + 0.4, o.w - 0.8, o.h - 0.8, o.r - 0.4)} fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="0.3" />
    </svg>
  );
}
