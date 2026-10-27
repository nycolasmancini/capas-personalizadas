"use client";
import { useEffect, useState } from "react";

const cache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit?.complete && hit.naturalWidth) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    // fotos já enviadas ficam em outro domínio; sem isso o canvas não pode ser exportado
    if (!src.startsWith("blob:") && !src.startsWith("data:") && !src.startsWith("/")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      cache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Não foi possível carregar a imagem`));
    img.src = src;
  });
}

export function useImage(src?: string) {
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    loadImage(src).then(
      (img) => alive && setLoaded({ src, img }),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [src]);
  if (!src) return null;
  if (loaded?.src === src) return loaded.img;
  const hit = cache.get(src);
  return hit?.complete && hit.naturalWidth ? hit : null;
}
