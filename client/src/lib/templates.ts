import type { Branding, SheetSettings, Block } from "@shared/schema";
import { nanoid } from "nanoid";

export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  branding: Branding;
  settings: SheetSettings;
};

const NCT_CATEGORIES = [
  "GOSSIP", "OPINION", "WEATHER", "TECH",
  "LIFESTYLE", "LOCAL", "BUSINESS", "WORLD",
];

function nct(id: string, active: string): TemplateDef {
  return {
    id,
    name: `NCT — ${active.charAt(0) + active.slice(1).toLowerCase()}`,
    description: `Night City Today front page, ${active.toLowerCase()} desk highlighted.`,
    branding: {
      outlet: "NIGHT CITY TODAY",
      tagline: "NEWS",
      accent: "#c0392b",
      headerBg: "#ffffff",
      headerText: "#111111",
      logoStyle: "nct",
    },
    settings: {
      clock: "12:00 AM",
      categories: NCT_CATEGORIES,
      activeCategory: active,
      showNav: true,
      ticker: "",
    },
  };
}

export const TEMPLATES: TemplateDef[] = [
  nct("nct-gossip", "GOSSIP"),
  nct("nct-opinion", "OPINION"),
  nct("nct-weather", "WEATHER"),
  nct("nct-tech", "TECH"),
  nct("nct-lifestyle", "LIFESTYLE"),
  nct("nct-local", "LOCAL"),
  nct("nct-business", "BUSINESS"),
  nct("nct-world", "WORLD"),
  {
    id: "augmented-optic",
    name: "The Augmented Optic",
    description: "Underground tabloid — all-seeing eye, conspiracy energy.",
    branding: {
      outlet: "The Augmented Optic",
      tagline: "ALL IS SEEN",
      accent: "#c0392b",
      headerBg: "#000000",
      headerText: "#ffffff",
      logoStyle: "optic",
    },
    settings: {
      clock: "12:00 AM",
      categories: [],
      activeCategory: "",
      showNav: false,
      ticker: "THE EYE SEES ALL // TRUST NO CORP // STAY JACKED IN",
    },
  },
  {
    id: "custom",
    name: "Custom Outlet",
    description: "Brand your own outlet — name, tagline, colors, layout.",
    branding: {
      outlet: "YOUR OUTLET",
      tagline: "TAGLINE",
      accent: "#00e0ff",
      headerBg: "#0a0a12",
      headerText: "#ffffff",
      logoStyle: "text",
    },
    settings: {
      clock: "12:00 AM",
      categories: ["NEWS", "DATA", "STREET", "CORP"],
      activeCategory: "NEWS",
      showNav: true,
      ticker: "",
    },
  },
];

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

// Starter content so a new sheet isn't empty.
export function starterBlocks(): Block[] {
  return [
    { id: nanoid(6), type: "headline", text: "CORPO COUP ROCKS WATSON DISTRICT", size: "lead" },
    { id: nanoid(6), type: "byline", author: "By V. NIGHTINGALE", dateline: "NIGHT CITY — 2077" },
    {
      id: nanoid(6),
      type: "paragraph",
      text: "In a stunning overnight maneuver, rival megacorps traded fire across the megabuilding skyline as fixers scrambled to broker an uneasy ceasefire. Authorities urge citizens to stay indoors and keep their cyberware patched.",
    },
    { id: nanoid(6), type: "pullquote", text: "Stay frosty. The night is long and the deals are longer.", attribution: "— Anonymous Fixer" },
    { id: nanoid(6), type: "brief", heading: "MARKET WATCH", text: "Eddies down 4% against the corporate scrip index. Black-market chrome surging." },
  ];
}

export function newBlock(type: Block["type"]): Block {
  const id = nanoid(6);
  switch (type) {
    case "headline": return { id, type, text: "NEW HEADLINE", size: "section" };
    case "byline": return { id, type, author: "By STAFF WRITER", dateline: "NIGHT CITY" };
    case "paragraph": return { id, type, text: "Type the story here..." };
    case "image": return { id, type, src: "", caption: "Photo caption" };
    case "pullquote": return { id, type, text: "A memorable quote.", attribution: "— Source" };
    case "ad": return { id, type, text: "RIPPERDOC SPECIAL — 20% OFF CHROME", sponsor: "Paid for by Viktor's Clinic" };
    case "sidebar": return { id, type, heading: "SIDEBAR", text: "Supporting details and context." };
    case "brief": return { id, type, heading: "BRIEF", text: "Short news brief." };
    case "divider": return { id, type };
  }
}
