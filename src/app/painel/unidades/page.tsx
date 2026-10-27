import { saveSetting, savePickupPoint } from "@/app/actions";
import { Button, Field, formatBRL, inputCls } from "@/components/ui";
import { getSetting, listPickupPoints } from "@/lib/business";

export const metadata = { title: "Unidades e preços" };

export default async function Unidades() {
  const [points, spot] = await Promise.all([listPickupPoints({ includeInactive: true }), getSetting("whiteSpotName")]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Unidades de retirada</h1>
        <p className="text-muted">
          Cada unidade tem endereço, prazo e preço próprios. A loja vê esses dados ao aprovar o pedido; o prazo conta em dias
          úteis a partir do pagamento (ou da aprovação, nas lojas faturadas).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {points.map((p) => (
          <form key={p.id} action={savePickupPoint} className="space-y-3 rounded-tile bg-card p-4">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-bold">{p.name}</p>
              <p className="text-sm text-muted">{formatBRL(p.priceCents)} por capa</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nome">
                <input name="name" defaultValue={p.name} required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Preço (R$)">
                  <input name="price" defaultValue={(p.priceCents / 100).toFixed(2).replace(".", ",")} required inputMode="decimal" className={inputCls} />
                </Field>
                <Field label="Prazo (dias úteis)">
                  <input name="leadDays" type="number" min={0} max={60} defaultValue={p.leadDays} required className={inputCls} />
                </Field>
              </div>
            </div>
            <Field label="Endereço de retirada">
              <input name="address" defaultValue={p.address} required className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Horário (opcional)">
                <input name="hours" defaultValue={p.hours ?? ""} className={inputCls} placeholder="Seg a sex, 9h às 18h" />
              </Field>
              <Field label="Link do Google Maps (opcional)">
                <input name="mapsUrl" defaultValue={p.mapsUrl ?? ""} className={inputCls} placeholder="https://maps.app.goo.gl/…" />
              </Field>
            </div>
            <Button className="w-full">Salvar {p.name}</Button>
          </form>
        ))}
      </div>

      <form action={saveSetting} className="max-w-lg space-y-3 rounded-tile bg-card p-4">
        <p className="text-lg font-bold">Impressão (Mimaki)</p>
        <Field
          label="Nome da cor especial do branco"
          hint="O PDF leva a camada de branco numa cor especial (spot color) com esse nome. Use o mesmo nome configurado no RasterLink."
        >
          <input name="whiteSpotName" defaultValue={spot} required maxLength={60} className={inputCls} />
        </Field>
        <Button variant="dark">Salvar</Button>
      </form>
    </div>
  );
}
