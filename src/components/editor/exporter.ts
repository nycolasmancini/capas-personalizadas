"use client";

import { BRAND } from "@/lib/brand";

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

function toBlob(c: HTMLCanvasElement, type = "image/png", q?: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), type, q),
  );
}

/**
 * Cartão de prévia para mandar ao cliente: 1080×1350 (formato de post),
 * fundo pastel e marca discreta.
 */
export async function composePreviewCard(mockupDataUrl: string, title: string, subtitle: string) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;

  x.fillStyle = "#fbf8f3";
  x.fillRect(0, 0, W, H);

  // bloco pastel
  x.fillStyle = "#d6ddf7";
  x.beginPath();
  x.roundRect(60, 60, W - 120, H - 300, 44);
  x.fill();

  const m = await loadImg(mockupDataUrl);
  const maxH = H - 380;
  const maxW = W - 220;
  const k = Math.min(maxH / m.height, maxW / m.width);
  const mw = m.width * k;
  const mh = m.height * k;
  x.drawImage(m, (W - mw) / 2, 60 + (H - 300 - mh) / 2, mw, mh);

  const font = getComputedStyle(document.body).fontFamily;
  x.fillStyle = "#16181d";
  x.font = `700 46px ${font}`;
  x.textBaseline = "alphabetic";
  x.fillText(title, 72, H - 150);
  x.fillStyle = "#4a4d56";
  x.font = `500 30px ${font}`;
  x.fillText(subtitle, 72, H - 100);

  x.font = `800 34px ${font}`;
  const brand = `${BRAND.name}`;
  const bw = x.measureText(brand + ".").width;
  x.fillStyle = "#16181d";
  x.fillText(brand, W - 72 - bw, H - 150);
  x.fillStyle = "#1d3fb0";
  x.fillText(".", W - 72 - x.measureText(".").width, H - 150);
  x.fillStyle = "#4a4d56";
  x.font = `500 22px ${font}`;
  const note = "Prévia ilustrativa";
  x.fillText(note, W - 72 - x.measureText(note).width, H - 104);

  return toBlob(c, "image/jpeg", 0.92);
}

/**
 * Camada de branco para impressora UV: preto sólido onde há tinta,
 * transparente onde a capa deve ficar cristal.
 */
export async function whiteLayerFromPrint(printDataUrl: string) {
  const img = await loadImg(printDataUrl);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3];
    p[i] = 0;
    p[i + 1] = 0;
    p[i + 2] = 0;
    p[i + 3] = a > 10 ? 255 : 0;
  }
  x.putImageData(data, 0, 0);
  return toBlob(c);
}

/** Confere se o arquivo de impressão tem algum pixel visível */
export async function hasInk(printDataUrl: string) {
  const img = await loadImg(printDataUrl);
  const c = document.createElement("canvas");
  const k = Math.min(1, 200 / img.width);
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, c.width, c.height);
  const p = x.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < p.length; i += 4) if (p[i] > 10) return true;
  return false;
}
