const ORIGIN = "https://case4you.s3.amazonaws.com/devices";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!/^[0-9a-f]{24}$/.test(path[0] ?? "") || path[1] !== "images" || !/\.png$/i.test(path.at(-1) ?? "")) {
    return new Response("Não encontrado", { status: 404 });
  }
  const res = await fetch(`${ORIGIN}/${path.map(encodeURIComponent).join("/")}`);
  if (!res.ok) return new Response("Não encontrado", { status: 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
