import { Plus } from "lucide-react";
import { DeviceAdminList } from "@/components/DeviceAdminList";
import { ButtonLink } from "@/components/ui";
import { listDevices } from "@/lib/data";

export const metadata = { title: "Aparelhos" };

export default async function Aparelhos() {
  const devices = await listDevices({ includeInactive: true });
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Aparelhos</h1>
          <p className="text-sm text-muted">Habilite os modelos que as lojas podem escolher.</p>
        </div>
        <ButtonLink href="/painel/aparelhos/novo">
          <Plus size={18} /> Novo modelo
        </ButtonLink>
      </div>
      <DeviceAdminList
        devices={devices.map((d) => ({
          id: d.id,
          brand: d.brand,
          name: d.name,
          geometry: d.geometry,
          mockup: d.mockup,
          active: d.active,
          verified: d.verified,
        }))}
      />
    </div>
  );
}
