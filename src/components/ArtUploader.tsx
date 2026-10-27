"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { createArt } from "@/app/actions";
import { uploadFile } from "@/lib/client-upload";
import { uid } from "@/lib/design";
import { Button, Field, inputCls } from "./ui";

function imageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1000, height: img.naturalHeight || 1000 });
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function ArtUploader({ categories }: { categories: string[] }) {
  const [category, setCategory] = useState(categories[0] ?? "Fundos");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    try {
      for (const f of [...files]) {
        const { width, height } = await imageSize(f);
        const ext = f.name.split(".").pop()?.toLowerCase() ?? "png";
        const url = await uploadFile(`artes/${uid()}.${ext}`, f, f.type);
        await createArt({ name: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), category, url, width, height });
      }
      setMsg(`${files.length} arte(s) adicionada(s)`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-tile bg-blue-soft p-4 lg:sticky lg:top-32">
      <p className="flex items-center gap-2 font-bold">
        <Upload size={18} /> Enviar artes
      </p>
      <Field label="Categoria" hint="Ex.: Fundos florais, Nomes, Signos, Times">
        <input list="art-cats" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} />
        <datalist id="art-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <p className="text-xs text-muted">
        PNG com fundo transparente para enfeites. Para fundos, use no mínimo 1000 × 2000 px. Pode selecionar vários
        arquivos de uma vez.
      </p>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <Button className="w-full" disabled={busy || !category.trim()} onClick={() => input.current?.click()}>
        {busy ? "Enviando…" : "Escolher arquivos"}
      </Button>
      {msg && <p className="text-sm font-semibold">{msg}</p>}
    </div>
  );
}
