import { forwardRef, type CSSProperties } from "react";
import type { EmailClientStyle, EmailMessage, EmailThreadArtifact } from "@shared/artifact";

/**
 * Phase 9: a fixed-width mail-client window showing an email thread.
 * Inline styles only (html-to-image copies them reliably for PNG/PDF export),
 * SVG glyphs instead of emoji, and no real-brand logos.
 */
export const EMAIL_WIDTH = 720;

interface Theme {
  font: string;
  mono: boolean;
  bg: string;
  text: string;
  muted: string;
  chromeBg: (accent: string) => string;
  chromeText: string;
  card: string;
  cardBorder: (accent: string) => string;
  cardRadius: number;
  quoteBorder: (accent: string) => string;
  chip: string;
  chipBorder: (accent: string) => string;
  upper: boolean;
}

const THEMES: Record<EmailClientStyle, Theme> = {
  corporate: {
    font: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    mono: false,
    bg: "#f3f4f6",
    text: "#1f2328",
    muted: "#6b7280",
    chromeBg: (a) => a,
    chromeText: "#ffffff",
    card: "#ffffff",
    cardBorder: () => "1px solid #e1e4e8",
    cardRadius: 4,
    quoteBorder: (a) => `3px solid ${a}55`,
    chip: "#f6f8fa",
    chipBorder: () => "1px solid #d0d7de",
    upper: false,
  },
  terminal: {
    font: "'Share Tech Mono', ui-monospace, Menlo, monospace",
    mono: true,
    bg: "#050806",
    text: "#d6f5d6",
    muted: "#6f8f76",
    chromeBg: () => "#0b120d",
    chromeText: "#d6f5d6",
    card: "#08100a",
    cardBorder: (a) => `1px solid ${a}66`,
    cardRadius: 0,
    quoteBorder: (a) => `2px dashed ${a}88`,
    chip: "#0b120d",
    chipBorder: (a) => `1px solid ${a}88`,
    upper: true,
  },
  webmail: {
    font: "Verdana, Tahoma, Arial, sans-serif",
    mono: false,
    bg: "#fffdf7",
    text: "#222222",
    muted: "#777777",
    chromeBg: (a) => `linear-gradient(90deg, ${a}, #8e44ad)`,
    chromeText: "#ffffff",
    card: "#ffffff",
    cardBorder: () => "1px solid #e6dcc8",
    cardRadius: 10,
    quoteBorder: () => "3px solid #d9cfba",
    chip: "#fff4e0",
    chipBorder: (a) => `1px solid ${a}88`,
    upper: false,
  },
};

const initials = (name: string, addr: string) =>
  (name || addr)
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function FlagIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-label="Flagged" role="img" data-testid="email-flag">
      <path d="M2 1v10M2 1.5h7l-1.6 2.5L9 6.5H2" fill={color} stroke={color} strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function ClipIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M8.5 3.5 4.3 7.7a1.2 1.2 0 0 0 1.7 1.7l4.4-4.4a2.4 2.4 0 0 0-3.4-3.4L2.6 6a3.6 3.6 0 0 0 5.1 5.1l3-3" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function Message({ m, t, accent, threadSubject }: { m: EmailMessage; t: Theme; accent: string; threadSubject: string }) {
  const showSubject = m.subject.trim() && m.subject.trim() !== threadSubject.trim();
  const line: CSSProperties = { fontSize: 12, color: t.muted, marginTop: 2, wordBreak: "break-word" };
  return (
    <div
      data-testid="email-message"
      data-msg-id={m.id}
      style={{ background: t.card, border: t.cardBorder(accent), borderRadius: t.cardRadius, padding: "14px 16px", marginBottom: 10 }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div
          aria-hidden="true"
          style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: t.mono ? 0 : 17,
            background: t.mono ? "transparent" : accent, border: t.mono ? `1px solid ${accent}` : "none",
            color: t.mono ? accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
          }}
        >
          {initials(m.fromName, m.fromAddress)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.mono ? accent : t.text, minWidth: 0, wordBreak: "break-word" }} data-testid="email-from">
              {m.fromName || m.fromAddress || "Unknown sender"}
              {m.fromName && m.fromAddress && (
                <span style={{ fontWeight: 400, color: t.muted, fontSize: 12 }}> &lt;{m.fromAddress}&gt;</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, fontSize: 12, color: t.muted }}>
              {m.flagged && <FlagIcon color={t.mono ? accent : "#d93025"} />}
              <span data-testid="email-time">{m.sentAt}</span>
            </div>
          </div>
          {m.to.length > 0 && <div style={line}>{t.upper ? "TO:" : "To:"} {m.to.join(", ")}</div>}
          {m.cc.length > 0 && <div style={line}>{t.upper ? "CC:" : "Cc:"} {m.cc.join(", ")}</div>}
          {showSubject && (
            <div style={{ ...line, color: t.text, fontWeight: 600 }} data-testid="email-msg-subject">
              {t.upper ? m.subject.toUpperCase() : m.subject}
            </div>
          )}
        </div>
      </div>

      <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55, marginTop: 12, color: t.text, wordBreak: "break-word" }} data-testid="email-body">
        {m.body || "\u00a0"}
      </div>

      {m.quoted.trim() && (
        <div
          data-testid="email-quoted"
          style={{ whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.5, marginTop: 10, color: t.muted, borderLeft: t.quoteBorder(accent), paddingLeft: 10 }}
        >
          {m.quoted}
        </div>
      )}

      {m.attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {m.attachments.map((a, i) => (
            <span
              key={i}
              data-testid="email-attachment"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, padding: "4px 8px",
                background: t.chip, border: t.chipBorder(accent), borderRadius: t.mono ? 0 : 4, color: t.text,
              }}
            >
              <ClipIcon color={t.muted} /> {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const EmailThreadRenderer = forwardRef<HTMLDivElement, { thread: EmailThreadArtifact }>(function EmailThreadRenderer({ thread }, ref) {
  const t = THEMES[thread.style] ?? THEMES.corporate;
  const accent = thread.accent || "#c0392b";
  const n = thread.messages.length;
  return (
    <div
      ref={ref}
      data-testid="email-thread"
      data-style={thread.style}
      style={{ width: EMAIL_WIDTH, background: t.bg, color: t.text, fontFamily: t.font, boxSizing: "border-box" }}
    >
      {/* window chrome */}
      <div
        style={{
          background: t.chromeBg(accent), color: t.chromeText, padding: "10px 16px", display: "flex",
          justifyContent: "space-between", alignItems: "center", gap: 12,
          borderBottom: t.mono ? `1px solid ${accent}` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
            <rect x="0.5" y="0.5" width="15" height="11" rx={t.mono ? 0 : 1.5} fill="none" stroke={t.mono ? accent : t.chromeText} />
            <path d="M1 1.5 8 7l7-5.5" fill="none" stroke={t.mono ? accent : t.chromeText} />
          </svg>
          <span data-testid="email-client-name" style={{ fontWeight: 700, fontSize: 13, letterSpacing: t.mono ? 2 : 0.3, color: t.mono ? accent : t.chromeText }}>
            {thread.clientName}
          </span>
        </div>
        {thread.mailbox && (
          <span data-testid="email-mailbox" style={{ fontSize: 12, opacity: 0.85, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {thread.mailbox}
          </span>
        )}
      </div>

      {thread.classification.trim() && (
        <div
          data-testid="email-classification"
          style={{
            background: t.mono ? "transparent" : "#b91c1c", color: t.mono ? accent : "#fff",
            border: t.mono ? `1px solid ${accent}` : "none", margin: t.mono ? "10px 16px 0" : 0,
            textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "4px 8px", textTransform: "uppercase",
          }}
        >
          {thread.classification}
        </div>
      )}

      <div style={{ padding: "16px 16px 6px" }}>
        <div
          data-testid="email-subject"
          style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, color: t.mono ? accent : t.text, wordBreak: "break-word", textTransform: t.upper ? "uppercase" : "none" }}
        >
          {thread.subject || "(no subject)"}
        </div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }} data-testid="email-count">
          {n} {n === 1 ? "message" : "messages"}
        </div>
      </div>

      <div style={{ padding: "8px 16px 6px" }} data-testid="email-messages">
        {thread.messages.map((m) => (
          <Message key={m.id} m={m} t={t} accent={accent} threadSubject={thread.subject} />
        ))}
      </div>

      {thread.showAttribution === true && (
        <div
          data-testid="email-attribution"
          style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: t.muted, textAlign: "center", textTransform: "uppercase", padding: "4px 0 14px" }}
        >
          Fictional · Made with Screamsheet Builder · screamsheet.vercel.app
        </div>
      )}
    </div>
  );
});

export default EmailThreadRenderer;
