import { useReducer, useRef, useCallback } from "react";
import type {
  AdjustmentStack,
  BaseLayer,
  EditorDoc,
  ImageOverlay,
  Overlay,
  TextOverlay,
} from "./types";
import { ZERO_ADJUSTMENTS } from "./types";

// History of EditorDoc snapshots. Capping at 50 entries keeps the memory
// footprint bounded — a doc with a handful of overlays is maybe a few KB,
// so 50 snapshots is well under a megabyte even with image refs (which
// store only URLs, not pixel data).
const HISTORY_LIMIT = 50;

export type EditorAction =
  | { type: "SET_NAME"; name: string }
  | { type: "SET_BASE"; base: BaseLayer | null }
  | { type: "SET_CANVAS"; width: number; height: number; background?: string }
  | { type: "SET_ADJUSTMENT"; key: keyof AdjustmentStack; value: number }
  | { type: "RESET_ADJUSTMENTS" }
  | { type: "ADD_OVERLAY"; overlay: Overlay }
  | { type: "UPDATE_OVERLAY"; id: string; patch: Partial<Overlay> }
  | { type: "REMOVE_OVERLAY"; id: string }
  | { type: "REORDER_OVERLAYS"; fromIndex: number; toIndex: number }
  | { type: "SELECT"; id: string | null }
  | { type: "LOAD"; doc: EditorDoc }
  | { type: "PUSH_HISTORY"; snapshot: EditorDoc }
  | { type: "UNDO" }
  | { type: "REDO" };

type State = {
  doc: EditorDoc;
  past: EditorDoc[];
  future: EditorDoc[];
};

export function newDoc(opts: {
  width?: number;
  height?: number;
  background?: string;
  base?: BaseLayer | null;
  name?: string;
} = {}): EditorDoc {
  const now = Date.now();
  return {
    id: `e_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: opts.name ?? "untitled",
    createdAt: now,
    updatedAt: now,
    canvas: {
      width: opts.width ?? opts.base?.naturalWidth ?? 1024,
      height: opts.height ?? opts.base?.naturalHeight ?? 1024,
      background: opts.background ?? "#000000",
    },
    base: opts.base ?? null,
    adjustments: { ...ZERO_ADJUSTMENTS },
    overlays: [],
    selectedId: null,
  };
}

// Discriminated-union-safe partial merge. The patch is typed `Partial<Overlay>`
// in the action, but at apply time we know the target's kind, so we narrow
// before spreading to keep TS happy and prevent kind-bleed between
// text/image variants.
function applyOverlayPatch(target: Overlay, patch: Partial<Overlay>): Overlay {
  if (target.kind === "text") {
    return { ...target, ...(patch as Partial<TextOverlay>) };
  }
  return { ...target, ...(patch as Partial<ImageOverlay>) };
}

function reduce(state: State, action: EditorAction): State {
  const { doc } = state;
  switch (action.type) {
    case "SET_NAME":
      return { ...state, doc: { ...doc, name: action.name, updatedAt: Date.now() } };
    case "SET_BASE":
      return {
        ...state,
        doc: { ...doc, base: action.base, updatedAt: Date.now() },
      };
    case "SET_CANVAS":
      return {
        ...state,
        doc: {
          ...doc,
          canvas: {
            width: action.width,
            height: action.height,
            background: action.background ?? doc.canvas.background,
          },
          updatedAt: Date.now(),
        },
      };
    case "SET_ADJUSTMENT": {
      // `rotate` is the only adjustment with a non-numeric type signature
      // (cardinal degrees). Narrow before assigning so we don't fall
      // through and write 47.3° into a 0|90|180|270 slot.
      if (action.key === "rotate") {
        const r = (((action.value % 360) + 360) % 360) as 0 | 90 | 180 | 270;
        return {
          ...state,
          doc: {
            ...doc,
            adjustments: { ...doc.adjustments, rotate: r },
            updatedAt: Date.now(),
          },
        };
      }
      return {
        ...state,
        doc: {
          ...doc,
          adjustments: { ...doc.adjustments, [action.key]: action.value },
          updatedAt: Date.now(),
        },
      };
    }
    case "RESET_ADJUSTMENTS":
      return {
        ...state,
        doc: { ...doc, adjustments: { ...ZERO_ADJUSTMENTS }, updatedAt: Date.now() },
      };
    case "ADD_OVERLAY":
      return {
        ...state,
        doc: {
          ...doc,
          overlays: [...doc.overlays, action.overlay],
          selectedId: action.overlay.id,
          updatedAt: Date.now(),
        },
      };
    case "UPDATE_OVERLAY": {
      const next = doc.overlays.map((o) =>
        o.id === action.id ? applyOverlayPatch(o, action.patch) : o
      );
      return { ...state, doc: { ...doc, overlays: next, updatedAt: Date.now() } };
    }
    case "REMOVE_OVERLAY":
      return {
        ...state,
        doc: {
          ...doc,
          overlays: doc.overlays.filter((o) => o.id !== action.id),
          selectedId: doc.selectedId === action.id ? null : doc.selectedId,
          updatedAt: Date.now(),
        },
      };
    case "REORDER_OVERLAYS": {
      const next = doc.overlays.slice();
      const [moved] = next.splice(action.fromIndex, 1);
      if (!moved) return state;
      next.splice(action.toIndex, 0, moved);
      return { ...state, doc: { ...doc, overlays: next, updatedAt: Date.now() } };
    }
    case "SELECT":
      return { ...state, doc: { ...doc, selectedId: action.id } };
    case "LOAD":
      return { doc: action.doc, past: [], future: [] };
    case "PUSH_HISTORY":
      return {
        ...state,
        past: [...state.past, action.snapshot].slice(-HISTORY_LIMIT),
        future: [],
      };
    case "UNDO": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        doc: prev,
        past: state.past.slice(0, -1),
        future: [doc, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }
    case "REDO": {
      const next = state.future[0];
      if (!next) return state;
      return {
        doc: next,
        past: [...state.past, doc].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

// Helper hook that wraps the reducer with a debounced history committer.
// The pattern: every mutating action also fires (debounced) a
// COMMIT_HISTORY, so a slider drag groups into a single undo entry rather
// than 60 entries per second. Selection changes don't commit.
export function useEditorStore(initial: EditorDoc) {
  const [state, dispatch] = useReducer(reduce, {
    doc: initial,
    past: [],
    future: [],
  });

  // Pending timer guarding the end-of-drag boundary. While the timer is
  // live, follow-on mutations belong to the same undo group and don't
  // re-snapshot. When it elapses, the next mutation starts a fresh group.
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatchWithHistory = useCallback(
    (action: EditorAction) => {
      const isMutating =
        action.type !== "SELECT" &&
        action.type !== "LOAD" &&
        action.type !== "UNDO" &&
        action.type !== "REDO" &&
        action.type !== "PUSH_HISTORY";

      if (isMutating) {
        // Only push history at the *start* of a new group — when no
        // debounce timer is currently armed. This collapses a slider
        // drag into a single undo entry whose snapshot is the doc as
        // it looked before the drag began.
        if (!pendingRef.current) {
          dispatch({ type: "PUSH_HISTORY", snapshot: state.doc });
        } else {
          clearTimeout(pendingRef.current);
        }
        pendingRef.current = setTimeout(() => {
          pendingRef.current = null;
        }, 350);
      }
      dispatch(action);
    },
    [state.doc]
  );

  return {
    state,
    dispatch: dispatchWithHistory,
    raw: dispatch,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
