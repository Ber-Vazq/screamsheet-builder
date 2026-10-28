import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { getGmKey } from "@/lib/gmKey";
import { useToast } from "@/hooks/use-toast";
import type { Artifact } from "@shared/artifact";
import {
  deserializeStoredRecord,
  ArtifactDecodeError,
  type StoredRecord,
} from "@shared/artifactCodec";
import { buildWritePayload, chooseWriteTarget } from "@shared/writeMetadata";
import { UPGRADE_ON_SAVE } from "@/lib/featureFlags";
import {
  clearDraft,
  draftKey,
  readDraft,
  shouldOfferDraft,
  writeDraft,
  type Draft,
  type DraftWriteResult,
} from "@/lib/drafts";

export type SaveMode = "update" | "create";

/** Wait this long after the last edit before autosaving. */
export const AUTOSAVE_DELAY_MS = 2000;
/** Wait this long after the last edit before writing a local draft. */
const DRAFT_DELAY_MS = 700;

export type SaveStatusState =
  | { kind: "new" } // never saved, no edits
  | { kind: "unsaved" } // edits not saved to the server
  | { kind: "saving"; auto: boolean }
  | { kind: "saved"; at: number | null }
  | { kind: "error"; message: string };

/**
 * Phase 7: share links use the path /s/:id. That path serves link-preview tags
 * (title, description, image) for Discord/iMessage, then redirects to /#/s/:id.
 * Old /#/s/:id links keep working unchanged.
 */
export function shareUrlFor(id: string, origin = window.location.origin): string {
  return `${origin}/s/${encodeURIComponent(id)}`;
}

/**
 * Reads ?edit= / ?load= from the URL. This app uses hash routing, so the query
 * may live in the real search string OR inside the hash (#/build/x?edit=ID).
 */
export function readSourceParams(search: string) {
  const hashQuery = typeof window !== "undefined" ? window.location.hash.split("?")[1] ?? "" : "";
  const sp = new URLSearchParams(search || hashQuery);
  return { editId: sp.get("edit"), loadId: sp.get("load") };
}

/** What the persistence hook needs from a builder's in-memory data. */
export interface PersistenceAdapter<A extends Artifact> {
  /** Template id from the URL; it wins on save and is part of the hash. */
  templateId: string;
  /** The only artifact type this builder can open. */
  expectedType: A["type"];
  /** Word used in messages: "sheet" or "thread". */
  noun: string;
  current: A;
  /** Replace the in-memory artifact; asCopy = the ?load= flow. Returns what was set. */
  load: (a: A, asCopy: boolean) => A;
  /** Reset to the template's starting content. Returns what was set. */
  reset: () => A;
  /** Fingerprint of exactly what a save would persist. */
  hash: (a: A, templateId: string) => string;
}

/**
 * All network I/O for a builder (sheet or text thread):
 *  - loads an existing artifact (edit in place or copy) through the artifact codec
 *  - saves via POST (create / save as copy) or PUT (overwrite, same share link)
 *  - Phase 6: dirty tracking, debounced autosave, local draft recovery
 */
export function useArtifactPersistence<A extends Artifact>(opts: {
  adapter: PersistenceAdapter<A>;
  editId: string | null;
  loadId: string | null;
  /** Phase 7: called after a successful manual save (not autosave). */
  onSaved?: (mode: SaveMode) => void;
}) {
  const { adapter, editId, loadId } = opts;
  const { templateId, noun } = adapter;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const current = adapter.current;
  const onSavedRef = useRef(opts.onSaved);
  onSavedRef.current = opts.onSaved;
  const { toast } = useToast();
  // When set, Save overwrites this record instead of creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Phase 5: schema version of the row being edited (0 = legacy, 1 = v1).
  const [storedVersion, setStoredVersion] = useState<number | null>(null);

  // --- Phase 6: dirty / saved tracking ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentHash = useMemo(() => adapter.hash(current, templateId), [current, templateId]);
  const currentHashRef = useRef(currentHash);
  currentHashRef.current = currentHash;
  /** Hash of the content last loaded or saved. null = still loading. dirty = currentHash !== baseHash. */
  const [baseHash, setBaseHash] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const failedHashRef = useRef<string | null>(null);
  const [draftOffer, setDraftOffer] = useState<Draft | null>(null);
  const [draftNote, setDraftNote] = useState<DraftWriteResult | null>(null);

  const key = draftKey({ editId: editingId, loadId: editingId ? null : loadId, template: templateId });
  const keyRef = useRef(key);
  keyRef.current = key;

  const dirty = baseHash !== null && currentHash !== baseHash;
  const hasKey = Boolean(getGmKey());
  const autosaveEnabled = Boolean(editingId) && hasKey;

  const sourceId = editId ?? loadId;

  /** Record what was just loaded as "saved", and offer a newer local draft if one exists. */
  const startBaseline = (loaded: A, serverChangedAt: number | null, k: string) => {
    const h = adapterRef.current.hash(loaded, templateId);
    setBaseHash(h);
    const draft = readDraft(k);
    setDraftOffer(shouldOfferDraft(draft, h, serverChangedAt) ? draft : null);
  };

  // --- load ---
  useEffect(() => {
    let cancelled = false;
    setBaseHash(null);
    setDraftOffer(null);
    setSaveError(null);
    failedHashRef.current = null;
    if (sourceId) {
      Promise.resolve(
        getQueryFn<unknown>({ on401: "throw" })({ queryKey: ["/api/screamsheets", sourceId] } as any),
      )
        .then((raw) => {
          if (cancelled || !raw) return;
          const artifact = deserializeStoredRecord(raw as StoredRecord);
          if (artifact.type !== adapterRef.current.expectedType) {
            throw new ArtifactDecodeError(`This builder cannot edit a ${artifact.type}`, artifact.id);
          }
          const loaded = adapterRef.current.load(artifact as A, !editId);
          setEditingId(editId ? sourceId : null);
          setStoredVersion(editId ? artifact.version : null);
          const changedAt = editId ? artifact.updatedAt ?? artifact.createdAt ?? null : null;
          setLastSavedAt(changedAt);
          startBaseline(loaded, changedAt, draftKey({ editId, loadId: editId ? null : loadId, template: templateId }));
        })
        .catch((err) => {
          if (cancelled) return;
          console.error(`[builder] failed to load ${noun}`, sourceId, err);
          toast({
            title: `Could not load ${noun}`,
            description: err instanceof ArtifactDecodeError ? err.message : `The ${noun} could not be opened.`,
            variant: "destructive",
          });
        });
    } else {
      const fresh = adapterRef.current.reset();
      setEditingId(null);
      setStoredVersion(null);
      setLastSavedAt(null);
      startBaseline(fresh, null, draftKey({ editId: null, loadId: null, template: templateId }));
    }
    setShareUrl(null);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, editId, loadId]);

  // --- local draft: write while dirty, clear when clean ---
  useEffect(() => {
    if (baseHash === null || draftOffer) return; // loading, or a draft the user hasn't decided on yet
    if (!dirty) {
      clearDraft(key);
      setDraftNote(null);
      return;
    }
    const t = setTimeout(() => setDraftNote(writeDraft(key, adapterRef.current.current, currentHash)), DRAFT_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHash, dirty, key, draftOffer, baseHash]);

  // --- save ---
  const save = useMutation({
    mutationFn: async ({ mode }: { mode: SaveMode; auto: boolean }) => {
      const ownerKey = getGmKey();
      const isUpdate = mode === "update" && Boolean(editingId);
      // Phase 5: creates/copies write v1. Updates keep a legacy row legacy
      // unless UPGRADE_ON_SAVE (Release B) is on. The URL template wins,
      // matching pre-refactor behavior.
      const a = adapterRef.current.current;
      const target = chooseWriteTarget(isUpdate ? "update" : "create", storedVersion, UPGRADE_ON_SAVE, a.type);
      const payload = { ...buildWritePayload(a, target), template: templateId, ownerKey };
      const sentHash = currentHashRef.current;
      const draftKeyAtSend = keyRef.current;
      const res = isUpdate
        ? await apiRequest("PUT", `/api/screamsheets/${editingId}?owner=${encodeURIComponent(ownerKey)}`, payload)
        : await apiRequest("POST", "/api/screamsheets", payload);
      return { raw: (await res.json()) as StoredRecord, mode: isUpdate ? ("update" as const) : ("create" as const), sentHash, draftKeyAtSend };
    },
    onSuccess: ({ raw, mode, sentHash, draftKeyAtSend }, { auto }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/screamsheets"] });
      const id = String(raw.id);
      // The response is the saved artifact; remember its version for the next save.
      if (typeof raw.version === "number") setStoredVersion(raw.version);
      setBaseHash(sentHash);
      setLastSavedAt(Date.now());
      setSaveError(null);
      failedHashRef.current = null;
      // Only drop the draft if nothing changed while the request was in flight.
      if (currentHashRef.current === sentHash) clearDraft(draftKeyAtSend);
      if (mode === "create") clearDraft(draftKeyAtSend);
      setShareUrl(shareUrlFor(id));
      // After a create, switch into edit mode so later saves overwrite it.
      if (mode === "create") setEditingId(id);
      if (auto) return; // autosave: inline status only, no toast
      onSavedRef.current?.(mode);
      const updated = mode === "update";
      const filed = getGmKey()
        ? updated
          ? "Changes saved. The same shareable link now shows your updates."
          : "Saved under your GM key. Shareable link is ready below. Further edits save automatically."
        : "Saved. Tip: set a GM key on the home page first so this shows up in your private library. Shareable link is ready below.";
      toast({ title: updated ? "Updated" : "Saved", description: filed });
    },
    onError: (err, { auto }) => {
      const fallback = noun === "sheet" ? "Could not save the screamsheet." : `Could not save the ${noun}.`;
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : fallback;
      setSaveError(msg || fallback);
      failedHashRef.current = currentHashRef.current;
      if (!auto) {
        toast({ title: "Save failed", description: `${fallback} Your edits are kept on this device.`, variant: "destructive" });
      }
    },
  });
  const savingRef = useRef(false);
  savingRef.current = save.isPending;

  // --- autosave: saved sheet + GM key + dirty, 2 s after the last edit ---
  useEffect(() => {
    if (!autosaveEnabled || !dirty || draftOffer || save.isPending) return;
    if (failedHashRef.current === currentHash) return; // don't hammer a failing save; retry on next edit or button
    const t = setTimeout(() => {
      if (!savingRef.current) save.mutate({ mode: "update", auto: true });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHash, autosaveEnabled, dirty, draftOffer, save.isPending]);

  // --- warn before leaving with unsaved edits ---
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const restoreDraft = useCallback(() => {
    if (!draftOffer) return;
    const cur = adapterRef.current.current;
    if (draftOffer.sheet.type !== cur.type) {
      setDraftOffer(null);
      return;
    }
    adapterRef.current.load({ ...cur, ...(draftOffer.sheet as A), id: cur.id, shareSlug: cur.shareSlug }, false);
    setDraftOffer(null); // baseHash unchanged -> restored edits show as unsaved (and autosave if enabled)
  }, [draftOffer]);

  const discardDraft = useCallback(() => {
    clearDraft(keyRef.current);
    setDraftOffer(null);
  }, []);

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard?.writeText(shareUrl);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
    }
  };

  const status: SaveStatusState = save.isPending
    ? { kind: "saving", auto: Boolean(save.variables?.auto) }
    : saveError && dirty
      ? { kind: "error", message: saveError }
      : dirty
        ? { kind: "unsaved" }
        : editingId
          ? { kind: "saved", at: lastSavedAt }
          : { kind: "new" };

  return {
    editingId,
    shareUrl,
    isSaving: save.isPending,
    save: (mode: SaveMode) => save.mutate({ mode, auto: false }),
    retry: () => save.mutate({ mode: editingId ? "update" : "create", auto: false }),
    copyLink,
    status,
    dirty,
    autosaveEnabled,
    hasGmKey: hasKey,
    draftOffer,
    draftNote,
    restoreDraft,
    discardDraft,
  };
}
