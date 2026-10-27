import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DevicePicker } from "@/components/DevicePicker";
import { requireStoreUser } from "@/lib/auth";
import { listDevices } from "@/lib/data";

export const metadata = { title: "Escolha o celular" };

export default async function NovaCapa() {
  await requireStoreUser();
  const devices = await listDevices();
  return (
    <div>
      <Link href="/loja" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Minhas capas
      </Link>
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Qual é o celular do cliente?</h1>
      <p className="mt-1 text-muted">Toque no modelo para começar a montar a capa.</p>
      <DevicePicker
        devices={devices.map((d) => ({
          id: d.id,
          brand: d.brand,
          name: d.name,
          rank: d.rank,
          geometry: d.geometry,
          mockup: d.mockup,
        }))}
      />
    </div>
  );
}
