import { useCallback, useState } from "react";
import type { Block, Branding, SheetSettings } from "@shared/schema";
import type { SheetArtifact } from "@shared/artifact";
import { newBlock, sheetArtifactFromTemplate, type TemplateDef } from "@/lib/templates";

const MAX_CATEGORIES = 8;

/** Move the item with id `activeId` to the index of `overId`. Unknown ids or same id -> unchanged array. */
export function reorderById<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((x) => x.id === activeId);
  const to = items.findIndex((x) => x.id === overId);
  if (from < 0 || to < 0 || from === to) return items;
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/**
 * Owns the in-memory sheet being edited. Everything is held as ONE
 * SheetArtifact so the rest of the builder never touches raw storage rows.
 * No network calls here — see useSheetPersistence.
 */
export function useSheetState(tpl: TemplateDef) {
  const [sheet, setSheet] = useState<SheetArtifact>(() => sheetArtifactFromTemplate(tpl));
  // Raw text of the comma-separated category input; committed to settings on blur.
  const [categoryRaw, setCategoryRaw] = useState(tpl.settings.categories.join(", "));

  const setTitle = useCallback((title: string) => setSheet((s) => ({ ...s, title })), []);
  const setBranding = useCallback((branding: Branding) => setSheet((s) => ({ ...s, branding })), []);
  const setSettings = useCallback((settings: SheetSettings) => setSheet((s) => ({ ...s, settings })), []);
  const setBlocks = useCallback(
    (fn: (bs: Block[]) => Block[]) => setSheet((s) => ({ ...s, blocks: fn(s.blocks) })),
    [],
  );

  // --- block ops ---
  const updateBlock = useCallback(
    (id: string, patch: Partial<Block>) =>
      setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b))),
    [setBlocks],
  );
  const addBlock = useCallback((type: Block["type"]) => setBlocks((bs) => [...bs, newBlock(type)]), [setBlocks]);
  const removeBlock = useCallback((id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id)), [setBlocks]);
  const moveBlock = useCallback(
    (id: string, dir: -1 | 1) =>
      setBlocks((bs) => {
        const i = bs.findIndex((b) => b.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= bs.length) return bs;
        const copy = [...bs];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return copy;
      }),
    [setBlocks],
  );
  /** Phase 7: drag-and-drop. Moves block `activeId` to where `overId` is. */
  const reorderBlock = useCallback(
    (activeId: string, overId: string) => setBlocks((bs) => reorderById(bs, activeId, overId)),
    [setBlocks],
  );
  const setBlockImage = useCallback(
    (id: string, file: File) => {
      const reader = new FileReader();
      reader.onload = () => updateBlock(id, { src: reader.result as string } as Partial<Block>);
      reader.readAsDataURL(file);
    },
    [updateBlock],
  );

  /** Parse the category input, cap at 8, keep the active tab valid. */
  const commitCategories = useCallback(() => {
    const cats = categoryRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_CATEGORIES);
    setSheet((s) => ({
      ...s,
      settings: {
        ...s.settings,
        categories: cats,
        activeCategory: cats.includes(s.settings.activeCategory) ? s.settings.activeCategory : cats[0] ?? "",
      },
    }));
    setCategoryRaw(cats.join(", "));
  }, [categoryRaw]);

  // --- whole-sheet replacement (used by persistence when loading) ---
  /** Returns the sheet it set, so callers can fingerprint it (Phase 6). */
  const resetToTemplate = useCallback((t: TemplateDef): SheetArtifact => {
    const next = sheetArtifactFromTemplate(t);
    setSheet(next);
    setCategoryRaw(t.settings.categories.join(", "));
    return next;
  }, []);

  /** asCopy=true is the ?load= flow: same content, "(copy)" title, no id yet. */
  const loadArtifact = useCallback((a: SheetArtifact, asCopy: boolean): SheetArtifact => {
    const next = asCopy
      ? { ...a, id: "", shareSlug: "", createdAt: null, title: a.title + " (copy)" }
      : a;
    setSheet(next);
    setCategoryRaw(a.settings.categories.join(", "));
    return next;
  }, []);

  return {
    sheet,
    categoryRaw,
    setCategoryRaw,
    commitCategories,
    setTitle,
    setBranding,
    setSettings,
    updateBlock,
    addBlock,
    removeBlock,
    moveBlock,
    reorderBlock,
    setBlockImage,
    resetToTemplate,
    loadArtifact,
  };
}

export type SheetState = ReturnType<typeof useSheetState>;
