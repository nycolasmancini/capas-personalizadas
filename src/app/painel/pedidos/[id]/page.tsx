import { ArrowLeft, Download, ExternalLink, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import { PickupCard } from "@/components/PickupCard";
import { ArtFromOrderPicker, CheckPixButton, MarkPaidButton, ReactivateButton, RevisionList } from "@/components/ProductionOrderTools";
import { NextStepButton, StatusSelect } from "@/components/StatusSelect";
import { formatBRL, formatDate, formatWhatsapp, StatusBadge, Tile, whatsappLink } from "@/components/ui";
import { getSetting, storeTerms } from "@/lib/business";
import { getDevice, getOrder, getPickupPoint, listPayments, listRevisions, listStoreOrders } from "@/lib/data";
import { PHONE_COLORS } from "@/lib/devices/catalog";

export const metadata = { title: "Pedido" };

export default async function PainelPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getOrder(id);
  if (!found) notFound();
  const { order: o, storeName, store } = found;
  const [device, point, revisions, pays, terms, spot, siblings] = await Promise.all([
    getDevice(o.deviceId),
    getPickupPoint(o.pickupPointId),
    listRevisions(o.id),
    listPayments(o.id),
    storeTerms(store),
    getSetting("whiteSpotName"),
    listStoreOrders(o.storeId, o.createdBy),
  ]);
  const g = o.design && device?.geometry;
  const paid = pays.find((p) => p.status === "approved" || p.status === "manual");
  const billing = o.billing ?? terms.billing;
  // outros pedidos da loja cuja arte pode substituir a deste (a loja pagou a capa errada)
  const candidates = siblings
    .filter((s) => s.id !== o.id && s.printUrl !== o.printUrl)
    .map((s) => ({
      id: s.id,
      code: s.code,
      deviceName: s.deviceName,
      customerName: s.customerName,
      previewUrl: s.previewUrl,
      status: s.status,
      paid: !!s.paidAt,
      createdAt: s.createdAt.toISOString(),
    }));

  const files = [
    {
      label: "Impressão + branco (PDF Mimaki)",
      hint: `Tamanho real, branco na cor especial “${spot}”`,
      url: `/api/pedidos/${o.id}/pdf?download=1`,
      name: `${o.code}-mimaki.pdf`,
      pdf: true,
    },
    {
      label: "Arquivo de impressão (PNG 300 dpi)",
      hint: g ? `${g.width} × ${g.height} mm, fundo transparente` : "",
      url: `${o.printUrl}?download=1`,
      name: `${o.code}-impressao.png`,
    },
    {
      label: "Camada de branco (PNG)",
      hint: "Preto = imprimir branco. Transparente = cristal.",
      url: `${o.whiteUrl}?download=1`,
      name: `${o.code}-branco.png`,
    },
    {
      label: "Prévia enviada ao cliente",
      hint: "JPG 1080 × 1350",
      url: `${o.previewUrl}?download=1`,
      name: `${o.code}-previa.jpg`,
    },
  ];

  return (
    <div>
      <Link
        href="/painel"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Pedidos
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_360px]">
        <Tile tone="blue" className="self-start overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.previewUrl} alt="Prévia" className="w-full" />
        </Tile>
        <Tile
          tone="sand"
          className="flex flex-col items-center justify-center self-start bg-[repeating-conic-gradient(#ece7de_0_25%,#fff_0_50%)] bg-[length:20px_20px] p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.printUrl} alt="Arquivo de impressão" className="max-h-[560px] w-auto drop-shadow" />
          <p className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-semibold">Arquivo de impressão</p>
        </Tile>

        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold">#{o.code}</span>
              <StatusBadge status={o.status} />
            </div>
            <h1 className="mt-1 font-display text-2xl">{o.deviceName}</h1>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted">Loja</dt>
              <dd className="font-semibold">
                {storeName ?? "—"}
                {store?.phone && (
                  <a
                    href={whatsappLink(store.phone) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 font-normal text-blue"
                  >
                    {formatWhatsapp(store.phone)}
                  </a>
                )}
              </dd>
              <dt className="text-muted">Vendedor</dt>
              <dd>{terms.sellerName ?? "—"}</dd>
              <dt className="text-muted">Pagamento</dt>
              <dd>
                {o.totalCents === 0 ? (
                  "Teste (admin) · sem cobrança"
                ) : (
                  <>
                    {billing === "faturado" ? "Faturado" : "PIX"} · {formatBRL(o.totalCents)}
                    {o.paidAt
                      ? ` · pago ${formatDate(o.paidAt)}${paid?.status === "manual" ? " (por fora)" : ""}`
                      : billing === "pix" && o.totalCents
                        ? " · em aberto"
                        : ""}
                  </>
                )}
              </dd>
              <dt className="text-muted">Cliente</dt>
              <dd>{o.customerName ?? "—"}</dd>
              <dt className="text-muted">Quantidade</dt>
              <dd className="font-semibold">{o.quantity}</dd>
              <dt className="text-muted">Cor do celular</dt>
              <dd>{PHONE_COLORS.find((c) => c.id === o.phoneColor)?.name}</dd>
              <dt className="text-muted">Enviado em</dt>
              <dd>{o.sentAt ? formatDate(o.sentAt) : "—"}</dd>
              <dt className="text-muted">Criado por</dt>
              <dd className="truncate">{o.createdBy}</dd>
            </dl>
            {o.notes && <p className="mt-3 whitespace-pre-line rounded-tile bg-butter/60 p-3 text-sm">{o.notes}</p>}
            {device && !device.verified && (
              <p className="mt-3 rounded-tile bg-peach/70 p-3 text-sm">
                ⚠️ Gabarito deste modelo ainda não conferido. Confira a linha de corte antes de imprimir.
              </p>
            )}
          </div>

          {point && <PickupCard point={point} dueAt={o.dueAt} faturado={billing === "faturado"} />}
          <PaymentReceipt payment={paid} code={o.code} />
          {o.needsReapproval && (
            <p className="rounded-tile bg-butter p-3 text-sm">
              Ajuste enviado para a loja aprovar de novo com o cliente.
            </p>
          )}

          {o.status === "cancelado" && <ReactivateButton id={o.id} paid={!!o.paidAt} />}
          {o.status === "aguardando_pagamento" && (
            <div className="space-y-2 rounded-tile bg-butter/60 p-3">
              <p className="text-sm">
                Aguardando o PIX de {formatBRL(o.totalCents)}. Se a loja mandou o comprovante e o pedido não
                avançou, confira direto no Mercado Pago.
              </p>
              <CheckPixButton orderId={o.id} />
              <MarkPaidButton id={o.id} totalCents={o.totalCents} />
            </div>
          )}
          <NextStepButton id={o.id} status={o.status} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-muted">Status</span>
            <StatusSelect id={o.id} status={o.status} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">Arquivos</p>
            {files.map((f) => (
              <a
                key={f.label}
                href={f.url}
                download={f.name}
                className="flex items-center gap-3 rounded-tile bg-card p-3 transition hover:bg-blue-soft"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sand">
                  {f.pdf ? <FileText size={18} /> : <Download size={18} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{f.label}</span>
                  <span className="block truncate text-xs text-muted">{f.hint}</span>
                </span>
              </a>
            ))}
            <Link
              href={`/p/${o.code}`}
              target="_blank"
              className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-blue"
            >
              Página pública da prévia <ExternalLink size={14} />
            </Link>
          </div>

          {o.status !== "cancelado" && (
            <>
              <Link
                href={`/loja/editor?pedido=${o.id}&producao`}
                className="flex h-11 items-center justify-center gap-2 rounded-ctl border-[1.5px] border-ink text-[15px] font-semibold transition hover:bg-ink hover:text-white"
              >
                <Pencil size={16} /> Editar arte (ajuste interno)
              </Link>
              <ArtFromOrderPicker orderId={o.id} candidates={candidates} />
            </>
          )}
          <RevisionList
            rows={revisions.map((r, i) => ({
              id: r.id,
              previewUrl: r.previewUrl,
              printUrl: r.printUrl,
              editedBy: r.editedBy,
              reason: r.reason,
              isOriginal: r.isOriginal,
              createdAt: r.createdAt.toISOString(),
              // a mais recente com os arquivos atuais (voltar uma versão repete os arquivos)
              current: i === revisions.findIndex((x) => x.printUrl === o.printUrl),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
