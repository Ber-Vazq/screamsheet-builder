import { forwardRef, type CSSProperties, type ReactNode } from "react";
import type { TextMessage, TextParticipant, TextPlatform, TextThreadArtifact } from "@shared/artifact";

/**
 * Phase 8: a fixed-width phone screen showing a text thread.
 * Inline styles only (html-to-image copies them reliably for PNG/PDF export),
 * SVG glyphs instead of emoji, and no real-brand names or logos.
 */
export const PHONE_WIDTH = 390;

interface Theme {
  font: string;
  bg: string;
  text: string;
  muted: string;
  headerBg: string;
  headerBorder: string;
  headerAlign: "center" | "left";
  selfBg: (p?: TextParticipant) => string;
  selfText: string;
  otherBg: (p?: TextParticipant) => string;
  otherText: string;
  bubbleBorder: (self: boolean, p?: TextParticipant) => string;
  radius: number;
  tail: number; // corner radius on the sender side
  composer: string;
  composerBg: string;
  glow?: (self: boolean, p?: TextParticipant) => string;
  upper?: boolean;
}

const THEMES: Record<TextPlatform, Theme> = {
  cyber: {
    font: "'Share Tech Mono', ui-monospace, monospace",
    bg: "#07070d",
    text: "#d8f7ff",
    muted: "#6f8a99",
    headerBg: "#0d0d18",
    headerBorder: "1px solid #00e5ff55",
    headerAlign: "left",
    selfBg: () => "#002a33",
    selfText: "#c9fbff",
    otherBg: () => "#140a1c",
    otherText: "#f4dcff",
    bubbleBorder: (self, p) => `1px solid ${self ? "#00e5ff" : p?.color ?? "#ff2bd6"}`,
    radius: 4,
    tail: 0,
    composer: "> transmit_",
    composerBg: "#0d0d18",
    glow: (self, p) => `0 0 10px ${self ? "#00e5ff44" : (p?.color ?? "#ff2bd6") + "44"}`,
    upper: true,
  },
  ios: {
    font: "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    bg: "#ffffff",
    text: "#000000",
    muted: "#8e8e93",
    headerBg: "#f6f6f8",
    headerBorder: "1px solid #d8d8dc",
    headerAlign: "center",
    selfBg: () => "#0a84ff",
    selfText: "#ffffff",
    otherBg: () => "#e9e9eb",
    otherText: "#000000",
    bubbleBorder: () => "none",
    radius: 18,
    tail: 5,
    composer: "Message",
    composerBg: "#ffffff",
  },
  android: {
    font: "Roboto, 'Segoe UI', Arial, sans-serif",
    bg: "#ffffff",
    text: "#1f1f1f",
    muted: "#5f6368",
    headerBg: "#ffffff",
    headerBorder: "1px solid #e0e0e0",
    headerAlign: "left",
    selfBg: () => "#d3e3fd",
    selfText: "#041e49",
    otherBg: () => "#f1f3f4",
    otherText: "#1f1f1f",
    bubbleBorder: () => "none",
    radius: 20,
    tail: 4,
    composer: "Text message",
    composerBg: "#f1f3f4",
  },
};

const STATUS_LABEL: Record<TextMessage["status"], string> = {
  none: "",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Not delivered",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function StatusBar({ clock, color }: { clock: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 22px 6px", fontSize: 14, fontWeight: 600, color }}>
      <span data-testid="thread-clock">{clock}</span>
      <svg width="62" height="12" viewBox="0 0 62 12" aria-hidden="true">
        {/* signal */}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 5} y={9 - i * 3} width="3.5" height={3 + i * 3} rx="0.8" fill={color} />
        ))}
        {/* wifi */}
        <path d="M27 4.5a9 9 0 0 1 12 0l-1.3 1.4a7 7 0 0 0-9.4 0Z M29.6 7.3a5.2 5.2 0 0 1 6.8 0L33 11Z" fill={color} />
        {/* battery */}
        <rect x="43" y="1.5" width="16" height="9" rx="2.2" fill="none" stroke={color} strokeWidth="1" />
        <rect x="44.6" y="3.1" width="11.5" height="5.8" rx="1.2" fill={color} />
        <rect x="59.6" y="4.5" width="1.6" height="3" rx="0.8" fill={color} />
      </svg>
    </div>
  );
}

function Avatar({ name, color, size = 34 }: { name: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

function BackGlyph({ color }: { color: string }) {
  return (
    <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true">
      <path d="M10 2 2 10l8 8" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Header({ t, thread, others }: { t: Theme; thread: TextThreadArtifact; others: TextParticipant[] }) {
  const lead = others[0];
  const title = thread.headerTitle || others.map((o) => o.name).join(", ") || "Messages";
  const accent = thread.platform === "ios" ? "#0a84ff" : thread.platform === "android" ? t.text : "#00e5ff";
  const avatar =
    others.length > 1 && thread.platform !== "cyber" ? (
      <div style={{ display: "flex" }}>
        {others.slice(0, 3).map((o, i) => (
          <div key={o.id} style={{ marginLeft: i ? -12 : 0, border: `2px solid ${t.headerBg}`, borderRadius: "50%" }}>
            <Avatar name={o.name} color={o.color} size={28} />
          </div>
        ))}
      </div>
    ) : lead ? (
      <Avatar name={lead.name} color={thread.platform === "cyber" ? "#140a1c" : lead.color} size={thread.platform === "ios" ? 42 : 36} />
    ) : null;

  if (t.headerAlign === "center") {
    return (
      <div style={{ background: t.headerBg, borderBottom: t.headerBorder, padding: "4px 14px 10px", position: "relative" }}>
        <div style={{ position: "absolute", left: 14, top: 18 }}><BackGlyph color={accent} /></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {avatar}
          <div data-testid="thread-title" style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{title}</div>
          {thread.headerSubtitle && <div style={{ fontSize: 11, color: t.muted }}>{thread.headerSubtitle}</div>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: t.headerBg, borderBottom: t.headerBorder, padding: "8px 14px 10px", display: "flex", alignItems: "center", gap: 12 }}>
      <BackGlyph color={accent} />
      {avatar}
      <div style={{ minWidth: 0 }}>
        <div
          data-testid="thread-title"
          style={{
            fontSize: 16, fontWeight: thread.platform === "cyber" ? 400 : 500, color: thread.platform === "cyber" ? "#00e5ff" : t.text,
            letterSpacing: thread.platform === "cyber" ? 2 : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {thread.platform === "cyber" ? title.toUpperCase() : title}
        </div>
        {thread.headerSubtitle && (
          <div style={{ fontSize: 11, color: thread.platform === "cyber" ? "#ff2bd6" : t.muted, letterSpacing: thread.platform === "cyber" ? 1 : 0 }}>
            {thread.headerSubtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({
  t, msg, self, sender, showName, isGroup, children,
}: {
  t: Theme; msg: TextMessage; self: boolean; sender?: TextParticipant; showName: boolean; isGroup: boolean; children: ReactNode;
}) {
  const r = t.radius;
  const style: CSSProperties = {
    background: self ? t.selfBg(sender) : t.otherBg(sender),
    color: self ? t.selfText : t.otherText,
    border: t.bubbleBorder(self, sender),
    boxShadow: t.glow?.(self, sender),
    borderRadius: self ? `${r}px ${r}px ${t.tail}px ${r}px` : `${r}px ${r}px ${r}px ${t.tail}px`,
    padding: msg.kind === "image" ? 4 : "8px 12px",
    maxWidth: 260,
    fontSize: 15,
    lineHeight: 1.3,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: self ? "flex-end" : "flex-start" }}>
      {showName && sender && (
        <div style={{ fontSize: 11, color: t === THEMES.cyber ? sender.color : t.muted, margin: "0 0 2px 12px", letterSpacing: t.upper ? 1 : 0 }}>
          {t.upper ? sender.name.toUpperCase() : sender.name}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: self ? "row-reverse" : "row" }}>
        {!self && isGroup && t !== THEMES.cyber && sender && <Avatar name={sender.name} color={sender.color} size={24} />}
        <div style={style}>{children}</div>
      </div>
    </div>
  );
}

function ImageBody({ src }: { src?: string }) {
  if (src) return <img src={src} alt="" style={{ display: "block", maxWidth: 240, maxHeight: 300, borderRadius: 14 }} crossOrigin="anonymous" />;
  return (
    <div style={{ width: 200, height: 130, display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed currentColor", borderRadius: 12, opacity: 0.6, fontSize: 12 }}>
      IMAGE
    </div>
  );
}

const TextThreadRenderer = forwardRef<HTMLDivElement, { thread: TextThreadArtifact }>(function TextThreadRenderer({ thread }, ref) {
  const t = THEMES[thread.platform] ?? THEMES.cyber;
  const byId = new Map(thread.participants.map((p) => [p.id, p]));
  const others = thread.participants.filter((p) => p.id !== thread.selfId);
  const isGroup = others.length > 1;
  // Status shows only under the last message the phone owner sent (like real apps).
  const lastSelfIdx = thread.messages.reduce((acc, m, i) => (m.kind !== "system" && m.from === thread.selfId ? i : acc), -1);

  return (
    <div
      ref={ref}
      data-testid="text-thread"
      data-platform={thread.platform}
      style={{
        width: PHONE_WIDTH, minHeight: 680, background: t.bg, color: t.text, fontFamily: t.font,
        display: "flex", flexDirection: "column", overflow: "hidden",
        backgroundImage: thread.platform === "cyber" ? "repeating-linear-gradient(0deg, #ffffff06 0 1px, transparent 1px 3px)" : undefined,
      }}
    >
      <div style={{ background: t.headerBg }}>
        <StatusBar clock={thread.clock} color={thread.platform === "cyber" ? "#00e5ff" : t.text} />
        <Header t={t} thread={thread} others={others} />
      </div>

      <div style={{ flex: 1, padding: "12px 12px 16px", display: "flex", flexDirection: "column", gap: 6 }} data-testid="thread-messages">
        {thread.messages.map((m, i) => {
          const prev = thread.messages[i - 1];
          const timeChip = m.sentAt ? (
            <div style={{ textAlign: "center", fontSize: 11, color: t.muted, margin: "8px 0 2px", letterSpacing: t.upper ? 1 : 0 }}>
              {t.upper ? m.sentAt.toUpperCase() : m.sentAt}
            </div>
          ) : null;
          if (m.kind === "system") {
            return (
              <div key={m.id} data-msg-id={m.id}>
                {timeChip}
                <div style={{ textAlign: "center", fontSize: 11, color: thread.platform === "cyber" ? "#ffd400" : t.muted, padding: "4px 20px", letterSpacing: t.upper ? 1 : 0 }}>
                  {t.upper ? `[ ${m.body.toUpperCase()} ]` : m.body}
                </div>
              </div>
            );
          }
          const self = m.from === thread.selfId;
          const sender = byId.get(m.from);
          const newSender = !prev || prev.kind === "system" || prev.from !== m.from || Boolean(m.sentAt);
          const status = self && i === lastSelfIdx ? STATUS_LABEL[m.status] : "";
          return (
            <div key={m.id} data-msg-id={m.id} style={{ marginTop: newSender && i ? 4 : 0 }}>
              {timeChip}
              <Bubble t={t} msg={m} self={self} sender={sender} showName={isGroup && !self && newSender} isGroup={isGroup}>
                {m.kind === "image" ? <ImageBody src={m.imageSrc} /> : m.body || "\u00a0"}
              </Bubble>
              {status && (
                <div
                  data-testid="thread-status"
                  style={{ textAlign: "right", fontSize: 11, marginTop: 2, paddingRight: 4, color: m.status === "failed" ? "#ff3b30" : t.muted, letterSpacing: t.upper ? 1 : 0 }}
                >
                  {t.upper ? status.toUpperCase() : status}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: "8px 12px 14px", borderTop: thread.platform === "cyber" ? "1px solid #00e5ff33" : "none" }}>
        <div
          style={{
            background: t.composerBg, border: thread.platform === "ios" ? "1px solid #d1d1d6" : thread.platform === "cyber" ? "1px solid #00e5ff55" : "none",
            borderRadius: thread.platform === "cyber" ? 2 : 20, padding: "9px 14px", fontSize: 14, color: t.muted,
          }}
        >
          {t.composer}
        </div>
      </div>

      {thread.showAttribution === true && (
        <div
          data-testid="thread-attribution"
          style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: 2, color: t.muted, textAlign: "center", textTransform: "uppercase", padding: "0 0 10px" }}
        >
          Fictional · Made with Screamsheet Builder · screamsheet.vercel.app
        </div>
      )}
    </div>
  );
});

export default TextThreadRenderer;
