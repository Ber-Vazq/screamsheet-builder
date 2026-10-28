import { useCallback, useState } from "react";
import type { Block, Branding, SheetSettings } from "@shared/schema";
import type { SheetArtifact } from "@shared/artifact";
import { newBlock, sheetArtifactFromTemplate, type TemplateDef } from "@/lib/templates";

const MAX_CATEGORIES = 8;

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
  const resetToTemplate = useCallback((t: TemplateDef) => {
    setSheet(sheetArtifactFromTemplate(t));
    setCategoryRaw(t.settings.categories.join(", "));
  }, []);

  /** asCopy=true is the ?load= flow: same content, "(copy)" title, no id yet. */
  const loadArtifact = useCallback((a: SheetArtifact, asCopy: boolean) => {
    setSheet(
      asCopy
        ? { ...a, id: "", shareSlug: "", createdAt: null, title: a.title + " (copy)" }
        : a,
    );
    setCategoryRaw(a.settings.categories.join(", "));
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
    setBlockImage,
    resetToTemplate,
    loadArtifact,
  };
}

export type SheetState = ReturnType<typeof useSheetState>;
