import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CameraNotice } from "@/components/CameraNotice";
import { OrderActions } from "@/components/OrderActions";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import { PickupCard } from "@/components/PickupCard";
import { PixPanel } from "@/components/PixPanel";
import { cn, formatDate, STATUS_INFO, StatusBadge, StatusStepper } from "@/components/ui";
import { requireStoreUser } from "@/lib/auth";
import { storeTerms } from "@/lib/business";
import { getOrder, getPickupPoint, listPayments, listRevisions } from "@/lib/data";
import { mpConfigured } from "@/lib/mercadopago";
import { latestPayment } from "@/lib/order-flow";

export const metadata = { title: "Pedido" };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStoreUser();
  const { id } = await params;
  const found = await getOrder(id);
  if (!found) notFound();
  const { order, store } = found;
  if (s.member.role !== "admin" && order.storeId !== s.store?.id) notFound();

  const [terms, point, payment, revisions, pays] = await Promise.all([
    storeTerms(store),
    getPickupPoint(order.pickupPointId),
    order.status === "aguardando_pagamento" ? latestPayment(order.id) : null,
    listRevisions(order.id),
    order.paidAt ? listPayments(order.id) : [],
  ]);
  const paid = pays.find((p) => p.status === "approved" || p.status === "manual");
  const lastEdit = revisions.find((r) => !r.isOriginal);
  const billing = order.billing ?? terms.billing;
  const info = STATUS_INFO[order.status];

  const steps = (["aguardando_cliente", "aguardando_pagamento", "recebido", "em_producao", "pronto", "retirado"] as const).filter(
    (st) => st !== "aguardando_pagamento" || billing === "pix",
  );

  return (
    <div>
      <Link href="/loja" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Minhas capas
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <figure className="self-start lg:sticky lg:top-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={order.previewUrl}
            alt="Prévia da capa"
            className="mx-auto w-full max-w-xl rounded-tile shadow-[0_20px_50px_-24px_rgba(22,24,29,0.45)]"
          />
        </figure>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted">#{order.code}</span>
              <StatusBadge status={order.status} />
            </div>
            <h1 className="mt-1 font-display text-3xl tracking-tight">{order.customerName || "Capa personalizada"}</h1>
            <p className="text-muted">
              {order.deviceName} · {order.quantity} un.
            </p>
          </div>

          {order.status !== "cancelado" && (
            <div className="rounded-tile bg-card p-4">
              <StatusStepper steps={steps} current={order.status} />
              {info.next && (
                <p className={cn("mt-4 rounded-ctl px-3 py-2 text-sm", info.tone)}>
                  <strong>{info.hint}</strong> {info.next}
                </p>
              )}
            </div>
          )}

          {lastEdit && (
            <p className="rounded-tile bg-blue-soft p-3 text-sm">
              <strong>Arte ajustada pela produção</strong> em {formatDate(lastEdit.createdAt)}
              {lastEdit.reason ? `: ${lastEdit.reason}` : "."}
              {order.needsReapproval && " Mostre a nova prévia ao cliente e aprove de novo."}
            </p>
          )}

          {order.status === "aguardando_pagamento" && (
            <PixPanel
              key={payment?.id ?? "sem-pix"}
              orderId={order.id}
              totalCents={order.totalCents}
              configured={mpConfigured()}
              pix={
                payment && {
                  qrCode: payment.qrCode,
                  qrCodeBase64: payment.qrCodeBase64,
                  expiresAt: payment.expiresAt?.toISOString() ?? null,
                  status: payment.status,
                }
              }
            />
          )}

          <PaymentReceipt payment={paid} code={order.code} />

          {point && order.status !== "cancelado" && order.status !== "aguardando_cliente" && (
            <PickupCard
              point={point}
              dueAt={order.dueAt}
              faturado={billing === "faturado"}
              ready={order.status === "pronto"}
            />
          )}

          <OrderActions
            id={order.id}
            code={order.code}
            status={order.status}
            previewUrl={order.previewUrl}
            customerName={order.customerName}
            terms={{
              billing: terms.billing,
              pickup: point && order.paidAt ? point : terms.pickup,
              points: terms.points,
              quantity: order.quantity,
              paid: !!order.paidAt,
              test: s.member.role === "admin",
            }}
          />

          {order.status === "aguardando_cliente" && <CameraNotice />}

          {order.notes && (
            <div className="rounded-tile bg-card p-4 text-sm">
              <p className="mb-1 font-semibold">Observações para a produção</p>
              <p className="whitespace-pre-line text-muted">{order.notes}</p>
            </div>
          )}
          <p className="text-xs text-muted">
            Criado por {order.createdBy} · atualizado {formatDate(order.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
