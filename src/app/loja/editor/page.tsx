import { notFound, redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { requireStoreUser } from "@/lib/auth";
import { getDevice, getOrder, listArts } from "@/lib/data";

export const metadata = { title: "Montar capa" };

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ aparelho?: string; pedido?: string; producao?: string }>;
}) {
  const s = await requireStoreUser();
  const { aparelho, pedido, producao } = await searchParams;

  if (pedido) {
    const found = await getOrder(pedido);
    if (!found) notFound();
    const { order } = found;
    if (s.member.role !== "admin" && order.storeId !== s.store?.id) notFound();
    // a produção ajusta a arte em qualquer etapa; a loja só enquanto o cliente não aprovou
    const asProduction = producao !== undefined && s.member.role === "admin";
    if (asProduction ? order.status === "cancelado" : order.status !== "aguardando_cliente") {
      redirect(asProduction ? `/painel/pedidos/${order.id}` : `/loja/pedidos/${order.id}`);
    }
    const [device, arts] = await Promise.all([getDevice(order.deviceId), listArts()]);
    if (!device) notFound();
    return (
      <Editor
        device={device}
        arts={arts}
        mode={asProduction ? "producao" : "loja"}
        backHref={asProduction ? `/painel/pedidos/${order.id}` : `/loja/pedidos/${order.id}`}
        initial={{
          orderId: order.id,
          design: order.design,
          customerName: order.customerName,
          notes: order.notes,
          quantity: order.quantity,
        }}
      />
    );
  }

  if (!aparelho) redirect("/loja/nova");
  const [device, arts] = await Promise.all([getDevice(aparelho), listArts()]);
  if (!device || !device.active) redirect("/loja/nova");
  return <Editor device={device} arts={arts} backHref="/loja/nova" />;
}
