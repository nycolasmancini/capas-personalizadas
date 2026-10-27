import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";

// Gera tokens para o navegador enviar fotos e arquivos direto ao Blob
// (sem passar pelo limite de 4,5 MB das funções).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getSession();
        if (!session || session === "blocked" || session === "new") throw new Error("Não autorizado");
        const isAdminPath = pathname.startsWith("artes/");
        if (isAdminPath && session.member.role !== "admin") throw new Error("Não autorizado");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
          maximumSizeInBytes: 30 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
