import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeviceForm } from "@/components/DeviceForm";
import { getDevice } from "@/lib/data";
import { DEVICE_CATALOG } from "@/lib/devices/catalog";

export const metadata = { title: "Editar aparelho" };

export default async function EditarAparelho({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  const device = isNew ? null : await getDevice(id);
  if (!isNew && !device) notFound();
  const template = DEVICE_CATALOG.find((d) => d.id === "galaxy-a15")!;

  return (
    <div>
      <Link href="/painel/aparelhos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Aparelhos
      </Link>
      <DeviceForm
        isNew={isNew}
        initial={
          device ?? {
            id: "",
            brand: "Samsung",
            name: "",
            rank: 100,
            active: true,
            verified: false,
            geometry: template.geometry,
            mockup: null,
          }
        }
      />
    </div>
  );
}
