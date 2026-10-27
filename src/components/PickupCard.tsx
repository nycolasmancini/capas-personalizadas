import { Clock, MapPin } from "lucide-react";
import type { PickupPoint } from "@/lib/db/schema";
import { cn, formatDay } from "./ui";

/** Endereço de retirada com o prazo (dias úteis) ou a data limite já calculada. */
export function PickupCard({
  point,
  dueAt,
  faturado,
  ready,
  className,
  children,
}: {
  point: Pick<PickupPoint, "name" | "address" | "hours" | "mapsUrl" | "leadDays">;
  dueAt?: Date | string | null;
  /** faturado: o prazo conta da aprovação, não do pagamento */
  faturado?: boolean;
  /** capa pronta: destaca o endereço para a loja ir buscar */
  ready?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const days = point.leadDays;
  const deadline = dueAt
    ? `Pronta até ${formatDay(dueAt)}`
    : `Pronta em até ${days} dia${days === 1 ? "" : "s"} úte${days === 1 ? "il" : "is"} após ${faturado ? "a aprovação" : "o pagamento"}`;
  return (
    <div className={cn("flex gap-3 rounded-tile p-4 text-sm", ready ? "bg-mint" : "bg-card", className)}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", ready ? "bg-white text-success" : "bg-blue-soft text-blue")}>
        <MapPin size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{ready ? `Retire em ${point.name}` : `Retirada em ${point.name}`}</p>
        <p className="text-muted">{point.address}</p>
        {point.hours && <p className="text-muted">{point.hours}</p>}
        {!ready && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 font-semibold">
            <Clock size={14} className="text-muted" /> {deadline}
          </p>
        )}
        {point.mapsUrl && (
          <a
            href={point.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className={cn("mt-1.5 block font-semibold underline-offset-2 hover:underline", ready ? "text-ink" : "text-blue")}
          >
            Abrir no mapa
          </a>
        )}
        {children}
      </div>
    </div>
  );
}
