// Phase 9: starting points for email threads ("template packs").
// Template id = pack id (stored in the `template` column).
// All companies, people and addresses are in-setting fiction / parody.
import { nanoid } from "nanoid";
import type { EmailClientStyle, EmailMessage, EmailThreadArtifact, EmailThreadSettings } from "@shared/artifact";

export interface EmailTemplateDef {
  id: string;
  name: string;
  description: string;
  style: EmailClientStyle;
  title: string;
  build: () => { settings: EmailThreadSettings; messages: EmailMessage[] };
}

/** Human labels for the three mail-client looks. No real-brand names on purpose. */
export const EMAIL_STYLE_LABELS: Record<EmailClientStyle, string> = {
  corporate: "Corporate client",
  terminal: "Secure terminal",
  webmail: "Free webmail",
};

export const newEmailId = () => nanoid(8);

type M = Partial<EmailMessage> & { fromName: string; fromAddress: string; body: string };
const msgs = (list: M[]): EmailMessage[] =>
  list.map((m) => ({ id: newEmailId(), to: [], cc: [], subject: "", sentAt: "", attachments: [], quoted: "", flagged: false, ...m }));

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    id: "email-arasaka-legal",
    name: "Arasaka legal notice",
    description: "Corporate counsel sends a cease-and-desist that is mostly a threat.",
    style: "corporate",
    title: "Arasaka legal: cease and desist",
    build: () => ({
      settings: {
        style: "corporate",
        clientName: "ARASAKA SECURE MAIL",
        mailbox: "j.kowalski@arasaka.corp",
        subject: "RE: Unauthorized Possession of Company Property",
        classification: "CONFIDENTIAL — ATTORNEY-CLIENT PRIVILEGED",
        accent: "#c0392b",
      },
      messages: msgs([
        {
          fromName: "Office of Legal Affairs",
          fromAddress: "legal.affairs@arasaka.corp",
          to: ["j.kowalski@arasaka.corp"],
          subject: "Unauthorized Possession of Company Property",
          sentAt: "Mon 08:00",
          body:
            "Mr. Kowalski,\n\nOur records show that a prototype data shard (asset tag AR-77-1138) left Tower 4 in your coat pocket on Friday.\n\n" +
            "Return it to Security Desk B within 24 hours. This is a courtesy. The next message will not come from Legal.\n\nRegards,\nOffice of Legal Affairs",
          attachments: ["Asset_AR-77-1138_Chain_of_Custody.pdf"],
          flagged: true,
        },
        {
          fromName: "Jan Kowalski",
          fromAddress: "j.kowalski@arasaka.corp",
          to: ["legal.affairs@arasaka.corp"],
          subject: "RE: Unauthorized Possession of Company Property",
          sentAt: "Mon 08:14",
          body: "I have no idea what shard you mean. I was home sick on Friday.\n\nJan",
          quoted: "Return it to Security Desk B within 24 hours. This is a courtesy.",
        },
        {
          fromName: "Office of Legal Affairs",
          fromAddress: "legal.affairs@arasaka.corp",
          to: ["j.kowalski@arasaka.corp"],
          cc: ["counterintel@arasaka.corp"],
          subject: "RE: RE: Unauthorized Possession of Company Property",
          sentAt: "Mon 08:15",
          body: "Your badge opened the vault door at 23:52 on Friday. Please don't make this complicated.\n\nThis message has been copied to Counterintelligence.",
          attachments: ["Badge_Log_Tower4.csv", "Lobby_Cam_2352.jpg"],
          quoted: "I have no idea what shard you mean. I was home sick on Friday.",
        },
      ]),
    }),
  },
  {
    id: "email-militech-ops",
    name: "Militech ops order",
    description: "A clipped field order for a strike team, with a nasty last-minute change.",
    style: "terminal",
    title: "Militech ops: Operation Dust Devil",
    build: () => ({
      settings: {
        style: "terminal",
        clientName: "MILITECH TACNET // OPS MAIL",
        mailbox: "sgt.reyes@tac.militech.mil",
        subject: "OPORD 0412 // OPERATION DUST DEVIL",
        classification: "SECRET // NOFORN // EYES ONLY",
        accent: "#7cfc00",
      },
      messages: msgs([
        {
          fromName: "LT. CMDR. HALE",
          fromAddress: "hale.ops@tac.militech.mil",
          to: ["sgt.reyes@tac.militech.mil"],
          subject: "OPORD 0412 // OPERATION DUST DEVIL",
          sentAt: "0412 0300Z",
          body:
            "SITUATION: Nomad convoy carrying stolen hardware, Badlands route 9.\n" +
            "MISSION: Intercept at grid 44-17. Recover crates. Minimize witnesses.\n" +
            "EXECUTION: AV insertion at 0500. Two fireteams. Comms silent after wheels down.\n" +
            "SUPPORT: Orbital overwatch NOT available.",
          attachments: ["GRID_44-17_SAT.img", "CONVOY_MANIFEST.enc"],
        },
        {
          fromName: "SGT. REYES",
          fromAddress: "sgt.reyes@tac.militech.mil",
          to: ["hale.ops@tac.militech.mil"],
          subject: "RE: OPORD 0412",
          sentAt: "0412 0322Z",
          body: "ACK. Request clarification on 'minimize witnesses.' Convoy may include civilians.",
        },
        {
          fromName: "LT. CMDR. HALE",
          fromAddress: "hale.ops@tac.militech.mil",
          to: ["sgt.reyes@tac.militech.mil"],
          subject: "RE: RE: OPORD 0412",
          sentAt: "0412 0323Z",
          body: "Clarification: there are no civilians in the Badlands. Proceed.\n\nUPDATE: Arasaka recovery team spotted 20 min out. Move up insertion to 0430.",
          quoted: "Request clarification on 'minimize witnesses.'",
          flagged: true,
        },
      ]),
    }),
  },
  {
    id: "email-gang-spam",
    name: "Gang spam inbox",
    description: "A cheap webmail inbox full of scam offers. One of them is a real threat.",
    style: "webmail",
    title: "Junk mail: the Maelstrom offer",
    build: () => ({
      settings: {
        style: "webmail",
        clientName: "FreeNet Mail",
        mailbox: "toxicpunk_2077@freenet.nc",
        subject: "!!! LIMITED CHROME DEAL — 90% OFF !!!",
        classification: "",
        accent: "#e67e22",
      },
      messages: msgs([
        {
          fromName: "Chrome Deals Direct",
          fromAddress: "deals@totally-legit-chrome.biz",
          to: ["toxicpunk_2077@freenet.nc"],
          subject: "!!! LIMITED CHROME DEAL — 90% OFF !!!",
          sentAt: "3:02 AM",
          body:
            "CONGRATULATIONS choomba!!!\n\nYou have been SELECTED for a FREE Mantis Blade upgrade. Just come to the Totentanz back door with 500 eddies (shipping & handling).\n\n" +
            "No refunds. No questions. No cops.\n\nUnsubscribe? lol no.",
          attachments: ["COUPON_100%_REAL.exe"],
        },
        {
          fromName: "Maelstrom Customer Care",
          fromAddress: "careteam@maelstrom.gang",
          to: ["toxicpunk_2077@freenet.nc"],
          subject: "Your account is past due",
          sentAt: "3:17 AM",
          body: "Hey. You still owe us for the optics. We know where you sleep. We also know you sleep badly.\n\nPay by Friday or we repossess. The optics. From your face.",
          flagged: true,
        },
      ]),
    }),
  },
  {
    id: "email-fixer-intel",
    name: "Fixer intel drop",
    description: "A fixer forwards a target dossier with a short, ominous note.",
    style: "terminal",
    title: "Fixer intel: the Watson dossier",
    build: () => ({
      settings: {
        style: "terminal",
        clientName: "DEADDROP v3.1 // ONION RELAY",
        mailbox: "ghost@deaddrop.onion",
        subject: "FWD: Target package — Watson",
        classification: "BURN AFTER READING",
        accent: "#ff2bd6",
      },
      messages: msgs([
        {
          fromName: "Mr. Hands",
          fromAddress: "hands@deaddrop.onion",
          to: ["ghost@deaddrop.onion"],
          subject: "FWD: Target package — Watson",
          sentAt: "23:59",
          body:
            "Package below. Target is mid-level corpo, Kabuki apartment, keeps odd hours.\n\n" +
            "Payment on delivery of the drive. Do NOT open the drive. I mean it this time.\n\n— H",
          attachments: ["dossier_watson.txt", "floorplan_unit_12C.png"],
          quoted:
            "---------- Forwarded message ----------\nFrom: [REDACTED]\nSubject: Target package\n\nSubject keeps a backup drive in a safe behind the fridge. Two guards, both bored.",
          flagged: true,
        },
      ]),
    }),
  },
  {
    id: "email-clinic-notice",
    name: "Ripperdoc clinic notice",
    description: "A clinic's polite automated notice about a very impolite situation.",
    style: "corporate",
    title: "Clinic notice: implant recall",
    build: () => ({
      settings: {
        style: "corporate",
        clientName: "Trauma Team Patient Portal",
        mailbox: "patient-4471@portal.traumateam.nc",
        subject: "IMPORTANT: Recall notice for your Kiroshi optics",
        classification: "PATIENT CONFIDENTIAL",
        accent: "#2e86de",
      },
      messages: msgs([
        {
          fromName: "Clinic Notifications",
          fromAddress: "no-reply@portal.traumateam.nc",
          to: ["patient-4471@portal.traumateam.nc"],
          subject: "IMPORTANT: Recall notice for your Kiroshi optics",
          sentAt: "Tue 10:30",
          body:
            "Dear Valued Patient,\n\nA batch of optical implants installed between March and June may display ads during sleep. In rare cases they may also record everything you see.\n\n" +
            "Please book a free replacement at your nearest clinic. Do not attempt to remove the implant yourself.\n\nThank you for choosing us.",
          attachments: ["Recall_FAQ.pdf"],
        },
        {
          fromName: "Doc Nix (Watson back-alley clinic)",
          fromAddress: "nix@watsonclinic.nc",
          to: ["patient-4471@portal.traumateam.nc"],
          subject: "RE: IMPORTANT: Recall notice",
          sentAt: "Tue 11:02",
          body: "Kid, ignore the portal. Swing by the shop after dark and I'll swap them, no records. Bring cash.",
          quoted: "Do not attempt to remove the implant yourself.",
        },
      ]),
    }),
  },
];

export const DEFAULT_EMAIL_TEMPLATE = "email-arasaka-legal";

export function getEmailTemplate(id: string | undefined): EmailTemplateDef {
  return EMAIL_TEMPLATES.find((t) => t.id === id) ?? EMAIL_TEMPLATES[0];
}

export function emailThreadFromTemplate(tpl: EmailTemplateDef): EmailThreadArtifact {
  const { settings, messages } = tpl.build();
  return {
    id: "",
    type: "emailThread",
    title: tpl.title,
    createdAt: null,
    updatedAt: null,
    shareSlug: "",
    gmKeyScoped: false,
    version: 1,
    template: tpl.id,
    ...settings,
    // New threads carry the credit line by default, like new sheets and texts.
    showAttribution: true,
    messages,
  };
}

/** Split "a@x, b@y" into a clean list (editor helper). */
export function parseAddressList(s: string): string[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

/** "Subject" -> "RE: Subject", without stacking RE: RE: forever. */
export function replySubject(s: string): string {
  const base = s.trim();
  if (!base) return "RE:";
  return /^re:/i.test(base) ? base : `RE: ${base}`;
}

/** Quote the start of a message body for a reply (first ~3 non-empty lines). */
export function quoteOf(m: EmailMessage): string {
  return m.body.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3).join("\n");
}
