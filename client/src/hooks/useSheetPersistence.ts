import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { getGmKey } from "@/lib/gmKey";
import { useToast } from "@/hooks/use-toast";
import type { TemplateDef } from "@/lib/templates";
import type { SheetState } from "@/hooks/useSheetState";
import {
  deserializeStoredRecord,
  ArtifactDecodeError,
  type StoredRecord,
} from "@shared/artifactCodec";
import { buildWritePayload, chooseWriteTarget } from "@shared/writeMetadata";
import { UPGRADE_ON_SAVE } from "@/lib/featureFlags";

export type SaveMode = "update" | "create";

/**
 * Reads ?edit= / ?load= from the URL. This app uses hash routing, so the query
 * may live in the real search string OR inside the hash (#/build/x?edit=ID).
 */
export function readSourceParams(search: string) {
  const hashQuery = typeof window !== "undefined" ? window.location.hash.split("?")[1] ?? "" : "";
  const sp = new URLSearchParams(search || hashQuery);
  return { editId: sp.get("edit"), loadId: sp.get("load") };
}

/**
 * All network I/O for the builder:
 *  - loads an existing sheet (edit in place or copy) through the artifact codec
 *  - saves via POST (create / save as copy) or PUT (overwrite, same share link)
 */
export function useSheetPersistence(opts: {
  tpl: TemplateDef;
  editId: string | null;
  loadId: string | null;
  state: SheetState;
}) {
  const { tpl, editId, loadId, state } = opts;
  const { toast } = useToast();
  // When set, Save overwrites this record instead of creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Phase 5: schema version of the row being edited (0 = legacy, 1 = v1).
  // null = nothing saved yet (new sheet or unsaved copy).
  const [storedVersion, setStoredVersion] = useState<number | null>(null);

  const sourceId = editId ?? loadId;

  // --- load ---
  useEffect(() => {
    let cancelled = false;
    if (sourceId) {
      Promise.resolve(
        getQueryFn<unknown>({ on401: "throw" })({ queryKey: ["/api/screamsheets", sourceId] } as any),
      )
        .then((raw) => {
          if (cancelled || !raw) return;
          const artifact = deserializeStoredRecord(raw as StoredRecord);
          if (artifact.type !== "sheet") {
            throw new ArtifactDecodeError(`Builder cannot edit a ${artifact.type}`, artifact.id);
          }
          state.loadArtifact(artifact, !editId);
          setEditingId(editId ? sourceId : null);
          setStoredVersion(editId ? artifact.version : null);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[builder] failed to load sheet", sourceId, err);
          toast({
            title: "Could not load sheet",
            description: err instanceof ArtifactDecodeError ? err.message : "The sheet could not be opened.",
            variant: "destructive",
          });
        });
    } else {
      state.resetToTemplate(tpl);
      setEditingId(null);
      setStoredVersion(null);
    }
    setShareUrl(null);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl.id, editId, loadId]);

  // --- save ---
  const save = useMutation({
    mutationFn: async (mode: SaveMode) => {
      const ownerKey = getGmKey();
      const isUpdate = mode === "update" && Boolean(editingId);
      // Phase 5: creates/copies write v1. Updates keep a legacy row legacy
      // unless UPGRADE_ON_SAVE (Release B) is on. The URL template wins,
      // matching pre-refactor behavior.
      const target = chooseWriteTarget(isUpdate ? "update" : "create", storedVersion, UPGRADE_ON_SAVE);
      const payload = { ...buildWritePayload(state.sheet, target), template: tpl.id, ownerKey };
      if (isUpdate) {
        const res = await apiRequest(
          "PUT",
          `/api/screamsheets/${editingId}?owner=${encodeURIComponent(ownerKey)}`,
          payload,
        );
        return { raw: (await res.json()) as StoredRecord, mode };
      }
      const res = await apiRequest("POST", "/api/screamsheets", payload);
      return { raw: (await res.json()) as StoredRecord, mode };
    },
    onSuccess: ({ raw, mode }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/screamsheets"] });
      const id = String(raw.id);
      // The response is the saved artifact; remember its version for the next save.
      if (typeof raw.version === "number") setStoredVersion(raw.version);
      setShareUrl(`${window.location.origin}${window.location.pathname}#/s/${id}`);
      // After a create, switch into edit mode so later saves overwrite it.
      if (mode === "create") setEditingId(id);
      const updated = mode === "update";
      const filed = getGmKey()
        ? updated
          ? "Changes saved. The same shareable link now shows your updates."
          : "Saved under your GM key. Shareable link is ready below."
        : "Saved. Tip: set a GM key on the home page first so this shows up in your private library. Shareable link is ready below.";
      toast({ title: updated ? "Updated" : "Saved", description: filed });
    },
    onError: () =>
      toast({ title: "Save failed", description: "Could not save the screamsheet.", variant: "destructive" }),
  });

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard?.writeText(shareUrl);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
    }
  };

  return {
    editingId,
    shareUrl,
    isSaving: save.isPending,
    save: (mode: SaveMode) => save.mutate(mode),
    copyLink,
  };
}
