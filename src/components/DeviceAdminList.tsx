"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { setDevicesActive } from "@/app/actions";
import type { Device } from "@/lib/devices/types";
import { DeviceSvg } from "./DeviceSvg";
import { Button, cn } from "./ui";

type AdminDevice = Pick<Device, "id" | "brand" | "name" | "geometry" | "mockup" | "active" | "verified">;
type Status = "todos" | "ativos" | "inativos" | "conferir";

const STATUSES: { id: Status; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Habilitados" },
  { id: "inativos", label: "Desabilitados" },
  { id: "conferir", label: "A conferir" },
];

const PAGE = 120;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function DeviceAdminList({ devices }: { devices: AdminDevice[] }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("todos");
  const [limit, setLimit] = useState(PAGE);
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // ligado/desligado aparece na hora; o servidor confirma em seguida
  const [active, setActive] = useOptimistic(
    useMemo(() => new Map(devices.map((d) => [d.id, d.active])), [devices]),
    (cur, { ids, on }: { ids: string[]; on: boolean }) => {
      const next = new Map(cur);
      for (const id of ids) next.set(id, on);
      return next;
    },
  );

  const brands = useMemo(() => {
    const n = new Map<string, number>();
    for (const d of devices) n.set(d.brand, (n.get(d.brand) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [devices]);

  const list = useMemo(() => {
    const terms = normalize(q).split(" ").filter(Boolean);
    return devices.filter((d) => {
      if (brand && d.brand !== brand) return false;
      const on = active.get(d.id);
      if (status === "ativos" && !on) return false;
      if (status === "inativos" && on) return false;
      if (status === "conferir" && d.verified) return false;
      const hay = normalize(`${d.brand} ${d.name}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [devices, q, brand, status, active]);

  const enabled = devices.filter((d) => active.get(d.id)).length;

  function set(ids: string[], on: boolean) {
    setErr(null);
    setConfirm(null);
    start(async () => {
      setActive({ ids, on });
      try {
        await setDevicesActive(ids, on);
      } catch (e) {
        setErr((e as Error).message || "Não foi possível salvar. Tente de novo.");
      }
    });
  }

  const resetPage = () => setLimit(PAGE);

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        <b className="text-ink">{enabled}</b> habilitados para as lojas · {devices.length - enabled} desabilitados
      </p>

      <div className="sticky top-16 z-20 -mx-4 mb-4 space-y-3 bg-paper/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <label className="flex h-11 min-w-0 flex-1 basis-64 items-center gap-2 rounded-tile border-[1.5px] border-line bg-white px-4 focus-within:border-blue">
            <Search size={18} className="text-muted" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                resetPage();
              }}
              placeholder="Buscar modelo…"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
              autoComplete="off"
            />
          </label>
          <div className="flex rounded-tile bg-card p-1">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStatus(s.id);
                  resetPage();
                }}
                className={cn(
                  "h-9 rounded-[10px] px-3 text-sm font-semibold transition",
                  status === s.id ? "bg-ink text-white" : "text-muted hover:text-ink",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          <Chip active={!brand} onClick={() => (setBrand(null), resetPage())}>
            Todas as marcas
          </Chip>
          {brands.map((b) => (
            <Chip key={b} active={brand === b} onClick={() => (setBrand(b === brand ? null : b), resetPage())}>
              {b}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-auto text-muted">
            {list.length} {list.length === 1 ? "modelo" : "modelos"} na lista
          </span>
          {confirm === null ? (
            <>
              <Button variant="ghost" className="h-9 px-3 text-sm" disabled={!list.length || pending} onClick={() => setConfirm(true)}>
                Habilitar todos
              </Button>
              <Button variant="ghost" className="h-9 px-3 text-sm" disabled={!list.length || pending} onClick={() => setConfirm(false)}>
                Desabilitar todos
              </Button>
            </>
          ) : (
            <>
              <span className="font-semibold">
                {confirm ? "Habilitar" : "Desabilitar"} {list.length} modelos?
              </span>
              <Button className="h-9 px-3 text-sm" onClick={() => set(list.map((d) => d.id), confirm)}>
                Confirmar
              </Button>
              <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => setConfirm(null)}>
                Cancelar
              </Button>
            </>
          )}
        </div>
        {err && <p className="rounded-ctl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
      </div>

      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {list.slice(0, limit).map((d) => {
            const on = !!active.get(d.id);
            return (
              <div key={d.id} className={cn("flex flex-col rounded-tile bg-card p-3 transition", !on && "opacity-60")}>
                <Link href={`/painel/aparelhos/${d.id}`} className="grid h-36 place-items-center rounded-[14px] bg-sand py-3">
                  <DeviceSvg g={d.geometry} mockup={d.mockup} className="h-28" showPrintArea={!d.mockup} />
                </Link>
                <p className="mt-2 text-sm font-semibold leading-tight">{d.name}</p>
                <p className="text-xs text-muted">
                  {d.brand} · {d.geometry.width}×{d.geometry.height} mm
                </p>
                <div className="mt-auto flex items-center justify-between gap-1 pt-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      d.verified ? "bg-mint" : d.geometry.estimated ? "bg-peach" : "bg-butter",
                    )}
                    title={d.geometry.estimated ? "Medidas estimadas pela foto" : undefined}
                  >
                    {d.verified ? "Conferido" : d.geometry.estimated ? "Medidas estimadas" : "A conferir"}
                  </span>
                  <Switch on={on} label={`${on ? "Desabilitar" : "Habilitar"} ${d.name}`} onChange={() => set([d.id], !on)} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-10 text-center text-muted">Nenhum modelo com esses filtros.</p>
      )}
      {list.length > limit && (
        <div className="mt-5 flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
            Mostrar mais ({list.length - limit})
          </Button>
        </div>
      )}
    </div>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-blue" : "bg-line")}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition",
        active ? "bg-ink text-white" : "bg-card text-ink hover:bg-sand",
      )}
    >
      {children}
    </button>
  );
}
