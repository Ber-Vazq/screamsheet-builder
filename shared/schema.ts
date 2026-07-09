import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// A screamsheet is a saved, shareable in-world news document for a tabletop session.
// Most of the rich content (blocks, branding, settings) lives in JSON columns.
export const screamsheets = sqliteTable("screamsheets", {
  id: text("id").primaryKey(), // nanoid, used as the share slug
  title: text("title").notNull(), // internal title for the GM's library
  template: text("template").notNull(), // template id, e.g. "nct-tech", "augmented-optic", "custom"
  // Branding overrides for custom sheets (name, tagline, colors, logo style)
  branding: text("branding", { mode: "json" }).$type<Branding>().notNull(),
  // Masthead / chrome settings (clock time, active category, ticker)
  settings: text("settings", { mode: "json" }).$type<SheetSettings>().notNull(),
  // Ordered list of content blocks
  blocks: text("blocks", { mode: "json" }).$type<Block[]>().notNull(),
  // Secret GM key that owns this sheet. The library only lists sheets matching
  // the GM's key; players opening a share link never receive this value.
  ownerKey: text("owner_key"),
  createdAt: integer("created_at").notNull(),
});

export type Branding = {
  outlet: string; // e.g. "NIGHT CITY TODAY"
  tagline: string; // e.g. "NEWS"
  accent: string; // hex highlight color for active tab / rules
  headerBg: string; // hex masthead background
  headerText: string; // hex masthead text
  logoStyle: "nct" | "optic" | "text" | "custom-image";
  logoSrc?: string;// which built-in logo treatment
};

export type SheetSettings = {
  clock: string; // e.g. "12:00 AM"
  categories: string[]; // nav tabs
  activeCategory: string; // which tab is highlighted in accent
  showNav: boolean; // tabloid templates hide the nav grid
  ticker: string; // optional scrolling breaking-news line
};

export type Block =
  | { id: string; type: "headline"; text: string; size: "lead" | "section" }
  | { id: string; type: "byline"; author: string; dateline: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; src: string; caption: string }
  | { id: string; type: "pullquote"; text: string; attribution: string }
  | { id: string; type: "ad"; text: string; sponsor: string; bgColor?: string; bgImage?: string; }
  | { id: string; type: "sidebar"; heading: string; text: string }
  | { id: string; type: "brief"; heading: string; text: string }
  | { id: string; type: "divider" };

export const blockSchema: z.ZodType<Block> = z.any();
export const brandingSchema: z.ZodType<Branding> = z.any();
export const settingsSchema: z.ZodType<SheetSettings> = z.any();

export const insertScreamsheetSchema = z.object({
  title: z.string().min(1),
  template: z.string().min(1),
  branding: brandingSchema,
  settings: settingsSchema,
  blocks: z.array(blockSchema),
  ownerKey: z.string().trim().optional(),
});

export type InsertScreamsheet = z.infer<typeof insertScreamsheetSchema>;
export type Screamsheet = typeof screamsheets.$inferSelect;
