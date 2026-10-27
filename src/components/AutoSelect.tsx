"use client";

import type { ComponentProps } from "react";

/** <select> que envia o formulário assim que muda (ações rápidas do painel). */
export function AutoSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
