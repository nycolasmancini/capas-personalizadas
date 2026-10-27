import { ChevronRight, ImagePlus, Plus } from "lucide-react";
import Link from "next/link";
import { ButtonLink, cn, Empty, formatDate, StatusBadge } from "@/components/ui";
import { requireStoreUser } from "@/lib/auth";
import { listStoreOrders } from "@/lib/data";
import type { Order } from "@/lib/db/schema";

export const metadata = { title: "Minhas capas" };

export default async function LojaHome() {
  const s = await requireStoreUser();
  const orders = await listStoreOrders(s.store?.id ?? null, s.email);
  const by = (...st: Order["status"][]) => orders.filter((o) => st.includes(o.status));
  const ready = by("pronto");
  const toPay = by("aguardando_pagamento");
  const waiting = by("aguardando_cliente");
  const active = by("recebido", "em_producao");
  const done = by("retirado", "cancelado");
  const first = s.member.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-muted">Olá{first ? `, ${first}` : ""} 👋</p>
        <h1 className="font-display text-4xl leading-tight tracking-tight">O que vamos criar hoje?</h1>
      </section>

      <Link
        href="/loja/nova"
        className="group flex items-center gap-4 rounded-tile bg-blue p-5 text-white shadow-[0_12px_30px_-14px_rgba(29,63,176,0.7)] transition hover:bg-blue-deep active:scale-[0.99] sm:p-6"
      >
        <span className="grid size-14 place-items-center rounded-full bg-white/15 transition group-hover:scale-105">
          <Plus size={28} />
        </span>
        <span className="flex-1">
          <span className="block font-display text-2xl">Nova capa</span>
          <span className="block text-sm text-white/80">Escolha o celular, monte a arte e mostre ao cliente</span>
        </span>
        <ChevronRight className="transition group-hover:translate-x-1" />
      </Link>

      {orders.length === 0 ? (
        <Empty
          title="Sua primeira capa começa aqui"
          icon={<ImagePlus size={22} />}
          action={
            <ButtonLink href="/loja/nova" variant="outline">
              Montar a primeira capa
            </ButtonLink>
          }
        >
          Escolha o celular do cliente, coloque as fotos e gere a prévia. As capas em andamento aparecem nesta tela.
        </Empty>
      ) : (
        <>
          <OrderSection
            title="Prontas para retirar"
            hint="Passe na unidade para buscar."
            tone="bg-mint"
            orders={ready}
          />
          <OrderSection title="Aguardando pagamento" hint="Pague o PIX para entrar na produção." tone="bg-pink" orders={toPay} />
          <OrderSection
            title="Aguardando o cliente aprovar"
            hint="Mostre a prévia e confirme quando ele aprovar."
            tone="bg-butter"
            orders={waiting}
          />
          <OrderSection title="Na produção" tone="bg-blue-soft" orders={active} />
          <OrderSection title="Finalizadas" tone="bg-sand" orders={done} muted />
        </>
      )}
    </div>
  );
}

function OrderSection({
  title,
  hint,
  orders,
  tone,
  muted,
}: {
  title: string;
  hint?: string;
  orders: Order[];
  tone: string;
  muted?: boolean;
}) {
  if (orders.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-bold">
          {title} <span className="font-semibold text-muted">({orders.length})</span>
        </h2>
        {hint && <p className="hidden text-sm text-muted sm:block">· {hint}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/loja/pedidos/${o.id}`}
            className={cn("group rounded-tile outline-none focus-visible:ring-[3px] focus-visible:ring-blue/35", muted && "opacity-80")}
          >
            <div className={cn("aspect-[4/5] overflow-hidden rounded-tile transition group-hover:-translate-y-0.5 group-hover:shadow-lg", tone)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.previewUrl} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
            </div>
            <div className="mt-2 min-w-0 px-0.5">
              <p className="truncate text-sm font-semibold">{o.customerName || o.deviceName}</p>
              <p className="truncate text-xs text-muted">
                {o.customerName ? `${o.deviceName} · ` : ""}#{o.code} · {formatDate(o.updatedAt)}
              </p>
              <div className="mt-1.5">
                <StatusBadge status={o.status} />
              </div>
              {o.status === "aguardando_cliente" && <p className="mt-1 text-xs font-semibold text-blue">Mostrar ao cliente →</p>}
              {o.status === "aguardando_pagamento" && <p className="mt-1 text-xs font-semibold text-blue">Pagar PIX →</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
