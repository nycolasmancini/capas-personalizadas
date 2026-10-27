import type { Design } from "@/lib/design";

export type ChangeMode = "commit" | "begin" | "live" | "end";

type State = { past: Design[]; present: Design; future: Design[]; pending: Design | null };

type Action =
  | { type: "change"; fn: (d: Design) => Design; mode: ChangeMode }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; design: Design };

const LIMIT = 60;

export function initHistory(design: Design): State {
  return { past: [], present: design, future: [], pending: null };
}

export function historyReducer(s: State, a: Action): State {
  switch (a.type) {
    case "change": {
      const next = a.fn(s.present);
      if (a.mode === "commit") {
        if (next === s.present) return s;
        return { past: [...s.past, s.present].slice(-LIMIT), present: next, future: [], pending: null };
      }
      if (a.mode === "begin") return { ...s, present: next, pending: s.pending ?? s.present };
      if (a.mode === "live") return { ...s, present: next };
      // end: registra o estado de antes do gesto como um passo de histórico
      if (!s.pending || s.pending === next) return { ...s, present: next, pending: null };
      return { past: [...s.past, s.pending].slice(-LIMIT), present: next, future: [], pending: null };
    }
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future], pending: null };
    }
    case "redo": {
      const [next, ...rest] = s.future;
      if (!next) return s;
      return { past: [...s.past, s.present], present: next, future: rest, pending: null };
    }
    case "reset":
      return initHistory(a.design);
  }
}
