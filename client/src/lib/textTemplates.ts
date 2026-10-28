// Phase 8: starting points for text-message threads.
// Template id = style preset id (stored in the `template` column).
import { nanoid } from "nanoid";
import type {
  TextMessage,
  TextParticipant,
  TextPlatform,
  TextThreadArtifact,
  TextThreadSettings,
} from "@shared/artifact";

export interface TextTemplateDef {
  id: string;
  name: string;
  description: string;
  platform: TextPlatform;
  title: string;
  build: () => { settings: TextThreadSettings; messages: TextMessage[] };
}

/** Human labels for the three visual styles. No real-brand names on purpose. */
export const PLATFORM_LABELS: Record<TextPlatform, string> = {
  cyber: "Cyberpunk",
  ios: "Glass (iOS-style)",
  android: "Material (Android-style)",
};

export const newId = () => nanoid(8);

type M = Partial<TextMessage> & { from: string; body: string };
const msgs = (list: M[]): TextMessage[] =>
  list.map((m) => ({ id: newId(), sentAt: "", kind: "text", status: "none", ...m }));

const p = (id: string, name: string, color: string): TextParticipant => ({ id, name, color });

export const TEXT_TEMPLATES: TextTemplateDef[] = [
  {
    id: "text-cyber",
    name: "Fixer job offer",
    description: "Encrypted agent chat. A fixer pitches a quick, too-good-to-be-true gig.",
    platform: "cyber",
    title: "Fixer: the Kabuki job",
    build: () => ({
      settings: {
        platform: "cyber",
        participants: [p("me", "You", "#00e5ff"), p("fixer", "Fixer", "#ff2bd6")],
        selfId: "me",
        headerTitle: "FIXER // ENCRYPTED",
        headerSubtitle: "Channel secured · 256-bit",
        clock: "11:47 PM",
      },
      messages: msgs([
        { kind: "system", from: "", body: "Secure channel opened" },
        { from: "fixer", body: "Got work. Clean in-and-out. Kabuki market, tonight.", sentAt: "11:42 PM" },
        { from: "fixer", body: "Pickup's a data shard. Client's paying 8k eddies. Half up front." },
        { from: "me", body: "Who's the client?", sentAt: "11:44 PM", status: "read" },
        { from: "fixer", body: "Client prefers to stay a client. Don't make it weird." },
        { from: "me", body: "Last time you said 'clean' I lost a cyberarm.", status: "read" },
        { from: "fixer", body: "And I paid for the new one. Meet at the noodle stand, 1 AM. Come alone.", sentAt: "11:46 PM" },
        { from: "me", body: "Fine. 10k.", status: "delivered" },
      ]),
    }),
  },
  {
    id: "text-ios",
    name: "Gang group chat (Glass)",
    description: "A rounded, glassy phone chat. A crew argues about tonight's plan.",
    platform: "ios",
    title: "Crew chat: tonight",
    build: () => ({
      settings: {
        platform: "ios",
        participants: [
          p("me", "You", "#0a84ff"),
          p("razor", "Razor", "#ff375f"),
          p("dee", "Dee", "#30d158"),
          p("bolt", "Bolt", "#ff9f0a"),
        ],
        selfId: "me",
        headerTitle: "Crew (no cops pls)",
        headerSubtitle: "4 people",
        clock: "9:41",
      },
      messages: msgs([
        { from: "razor", body: "Who took the van keys", sentAt: "Today 9:12 PM" },
        { from: "dee", body: "not me. ask bolt" },
        { from: "bolt", body: "i needed snacks" },
        { from: "razor", body: "WE ARE ROBBING A WAREHOUSE IN 40 MIN" },
        { from: "me", body: "I'm 5 out. Bring the keys or walk.", status: "delivered" },
        { from: "bolt", body: "ok ok on my way. got u all chips tho" },
        { kind: "system", from: "", body: "Dee changed the group name to \"Crew (no cops pls)\"" },
        { from: "me", body: "Ditch the phones at the door.", status: "read" },
      ]),
    }),
  },
  {
    id: "text-android",
    name: "Gang group chat (Material)",
    description: "A flat, material-style phone chat. Someone saw something they shouldn't have.",
    platform: "android",
    title: "Crew chat: the alley",
    build: () => ({
      settings: {
        platform: "android",
        participants: [
          p("me", "You", "#1a73e8"),
          p("mox", "Mox", "#d93025"),
          p("tink", "Tink", "#188038"),
        ],
        selfId: "me",
        headerTitle: "Back Alley Boys",
        headerSubtitle: "Mox, Tink, You",
        clock: "2:13",
      },
      messages: msgs([
        { from: "mox", body: "yo did anyone else hear that", sentAt: "2:04 AM" },
        { from: "tink", body: "the explosion?? yeah. 3 blocks from me" },
        { from: "mox", body: "corpo AV just landed on the roof of the clinic" },
        { from: "me", body: "Stay inside. Don't post anything.", status: "read", sentAt: "2:09 AM" },
        { from: "tink", body: "too late i already sent a pic to my cousin" },
        { from: "me", body: "Delete it. Now.", status: "failed" },
        { from: "mox", body: "your msgs aren't going thru btw" },
      ]),
    }),
  },
];

export const DEFAULT_TEXT_TEMPLATE = "text-cyber";

export function getTextTemplate(id: string | undefined): TextTemplateDef {
  return TEXT_TEMPLATES.find((t) => t.id === id) ?? TEXT_TEMPLATES[0];
}

export function isTextTemplateId(id: string | undefined | null): boolean {
  return Boolean(id && TEXT_TEMPLATES.some((t) => t.id === id));
}

export function textThreadFromTemplate(tpl: TextTemplateDef): TextThreadArtifact {
  const { settings, messages } = tpl.build();
  return {
    id: "",
    type: "textThread",
    title: tpl.title,
    createdAt: null,
    updatedAt: null,
    shareSlug: "",
    gmKeyScoped: false,
    version: 1,
    template: tpl.id,
    ...settings,
    // New threads carry the credit line by default, like new sheets.
    showAttribution: true,
    messages,
  };
}
