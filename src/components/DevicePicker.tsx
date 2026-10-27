"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Device } from "@/lib/devices/types";
import { DeviceSvg } from "./DeviceSvg";
import { cn, focusRing } from "./ui";

type PickerDevice = Pick<Device, "id" | "brand" | "name" | "rank" | "geometry" | "mockup">;

const TONES = ["bg-pink", "bg-butter", "bg-mint", "bg-peach", "bg-blue-soft", "bg-sand"];
const POPULAR = 6;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/galaxy|iphone|moto|redmi|xiaomi|samsung|apple|motorola/g, (m) => ` ${m} `)
    .replace(/\s+/g, " ")
    .trim();
}

export function DevicePicker({ devices }: { devices: PickerDevice[] }) {
  const [q, setQ] = useState("");
  const brands = useMemo(() => [...new Set(devices.map((d) => d.brand))], [devices]);
  const [brand, setBrand] = useState<string | null>(null);

  const list = useMemo(() => {
    const terms = normalize(q).split(" ").filter(Boolean);
    return devices.filter((d) => {
      if (brand && d.brand !== brand) return false;
      if (!terms.length) return true;
      const hay = normalize(`${d.brand} ${d.name}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [devices, q, brand]);

  const browsing = !q.trim() && !brand;
  const popular = devices.slice(0, POPULAR);
  // navegando sem filtro: "mais pedidos" em cima e o resto agrupado por marca
  const groups = useMemo(() => {
    const rest = browsing ? list.filter((d) => !popular.includes(d)) : list;
    const map = new Map<string, PickerDevice[]>();
    for (const d of rest) map.set(d.brand, [...(map.get(d.brand) ?? []), d]);
    return [...map.entries()];
  }, [browsing, list, popular]);

  return (
    <div className="mt-5">
      <div className="sticky top-16 z-20 -mx-4 bg-paper/95 px-4 pb-3 pt-1 backdrop-blur">
        <label className="flex h-12 items-center gap-2 rounded-tile border-[1.5px] border-line bg-white px-4 transition focus-within:border-blue focus-within:ring-[3px] focus-within:ring-blue/15">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar modelo: 15 pro, a55, g84…"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Buscar modelo"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"
              aria-label="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </label>
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
          <Chip active={!brand} onClick={() => setBrand(null)}>
            Todos
          </Chip>
          {brands.map((b) => (
            <Chip key={b} active={brand === b} onClick={() => setBrand(b === brand ? null : b)}>
              {b}
            </Chip>
          ))}
        </div>
      </div>

      {browsing && (
        <section className="mb-7">
          <SectionTitle>Mais pedidos</SectionTitle>
          <Grid devices={popular} />
        </section>
      )}

      {list.length === 0 ? (
        <div className="rounded-tile border-[1.5px] border-dashed border-line px-6 py-10 text-center">
          <p className="font-semibold">Nenhum modelo com “{q.trim()}”.</p>
          <p className="mt-1 text-sm text-muted">Tente só o número (ex.: “15”) ou peça para a produção cadastrar o aparelho.</p>
        </div>
      ) : (
        groups.map(([b, items]) => (
          <section key={b} className="mb-7">
            <SectionTitle>
              {b} <span className="font-semibold normal-case tracking-normal text-muted/70">· {items.length}</span>
            </SectionTitle>
            <Grid devices={items} />
          </section>
        ))
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{children}</h2>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition",
        focusRing,
        active ? "bg-ink text-white" : "bg-card text-ink hover:bg-sand",
      )}
    >
      {children}
    </button>
  );
}

function Grid({ devices }: { devices: PickerDevice[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {devices.map((d, i) => (
        <Link
          key={d.id}
          href={`/loja/editor?aparelho=${d.id}`}
          className={cn(
            "group flex flex-col items-center rounded-tile bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]",
            focusRing,
          )}
        >
          <div className={cn("grid w-full place-items-center rounded-[14px] py-3", TONES[i % TONES.length])}>
            <DeviceSvg g={d.geometry} mockup={d.mockup} className="h-24 transition group-hover:scale-105" />
          </div>
          <p className="mt-2 text-center text-[13px] font-semibold leading-tight">{d.name}</p>
          <p className="text-[11px] text-muted">{d.brand}</p>
        </Link>
      ))}
    </div>
  );
}
