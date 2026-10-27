import { getSession } from "@/lib/auth";
import { getSetting } from "@/lib/business";
import { getOrder } from "@/lib/data";
import { PRINT_DPI } from "@/lib/devices/geometry";
import { buildPrintPdf } from "@/lib/print/pdf";

// PDF para a Mimaki (arte + branco), gerado na hora a partir do PNG 300 dpi.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || typeof s === "string" || s.member.role !== "admin") {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const found = await getOrder(id);
  if (!found) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  const o = found.order;

  const res = await fetch(o.printUrl);
  if (!res.ok) return Response.json({ error: "Arquivo de impressão indisponível" }, { status: 502 });
  const png = new Uint8Array(await res.arrayBuffer());
  // largura/altura do PNG → mm (o PNG é sempre exportado a 300 dpi no tamanho real)
  const w = new DataView(png.buffer).getUint32(16);
  const h = new DataView(png.buffer).getUint32(20);
  const mm = (px: number) => (px * 25.4) / PRINT_DPI;

  const pdf = await buildPrintPdf({
    png,
    widthMm: mm(w),
    heightMm: mm(h),
    spotName: await getSetting("whiteSpotName"),
    title: `#${o.code} · ${o.deviceName}`,
  });
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${o.code}-mimaki.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
