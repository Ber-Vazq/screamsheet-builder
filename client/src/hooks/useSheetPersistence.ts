import type { TemplateDef } from "@/lib/templates";
import type { SheetState } from "@/hooks/useSheetState";
import type { SheetArtifact } from "@shared/artifact";
import { sheetContentHash } from "@/lib/sheetSnapshot";
import { useArtifactPersistence, type PersistenceAdapter, type SaveMode } from "@/hooks/useArtifactPersistence";

// Phase 8: the logic moved to useArtifactPersistence (shared with text threads).
// These re-exports keep existing imports working.
export {
  AUTOSAVE_DELAY_MS,
  shareUrlFor,
  readSourceParams,
  type SaveMode,
  type SaveStatusState,
} from "@/hooks/useArtifactPersistence";

/** Builder persistence for screamsheets. Behavior is unchanged from Phase 6/7. */
export function useSheetPersistence(opts: {
  tpl: TemplateDef;
  editId: string | null;
  loadId: string | null;
  state: SheetState;
  onSaved?: (mode: SaveMode) => void;
}) {
  const { tpl, state } = opts;
  const adapter: PersistenceAdapter<SheetArtifact> = {
    templateId: tpl.id,
    expectedType: "sheet",
    noun: "sheet",
    current: state.sheet,
    load: state.loadArtifact,
    reset: () => state.resetToTemplate(tpl),
    hash: sheetContentHash,
  };
  return useArtifactPersistence({ adapter, editId: opts.editId, loadId: opts.loadId, onSaved: opts.onSaved });
}
