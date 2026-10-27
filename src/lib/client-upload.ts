"use client";
import { upload } from "@vercel/blob/client";

export async function uploadFile(pathname: string, body: Blob, contentType?: string) {
  const res = await upload(pathname, body, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType: contentType ?? body.type,
    multipart: body.size > 8 * 1024 * 1024,
  });
  return res.url;
}

/** Reduz fotos grandes no próprio aparelho antes de enviar (mais rápido no 4G). */
export async function prepareImage(file: File, maxSide = 2600) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao processar a imagem"))),
      keepAlpha ? "image/png" : "image/jpeg",
      0.9,
    ),
  );
  return { blob, width: w, height: h, url: URL.createObjectURL(blob) };
}

export function dataUrlToBlob(dataUrl: string) {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
