import { Camera } from "lucide-react";
import { cn } from "./ui";

export const CAMERA_NOTICE = {
  title: "Câmera aberta ou fechada",
  short: "A prévia mostra a câmera aberta. Conforme o fabricante, a capa pode vir fechada (só as lentes de fora). Estampa e proteção são as mesmas.",
  body: "A prévia mostra a câmera aberta. Conforme o modelo de capa do fabricante, ela pode vir com a câmera aberta (todo o módulo à mostra) ou fechada (só as lentes de fora, com o espaço entre elas preenchido). A estampa e a proteção são as mesmas.",
};

/** Aviso de que a capa pode vir com câmera aberta ou fechada. Toque para ver a explicação. */
export function CameraNotice({ className, open }: { className?: string; open?: boolean }) {
  return (
    <details open={open} className={cn("group rounded-tile bg-card px-4 py-3 text-sm", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        <Camera size={16} className="shrink-0 text-blue" />
        {CAMERA_NOTICE.title}
        <span className="ml-auto text-xs font-semibold text-blue group-open:hidden">Saiba mais</span>
      </summary>
      <p className="mt-2 text-muted">{CAMERA_NOTICE.body}</p>
    </details>
  );
}
