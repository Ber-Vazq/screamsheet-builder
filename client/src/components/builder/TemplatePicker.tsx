import { Link } from "wouter";
import { Mail, MessageSquare, Newspaper } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import { TEXT_TEMPLATES, PLATFORM_LABELS, type TextTemplateDef } from "@/lib/textTemplates";
import { EMAIL_TEMPLATES, EMAIL_STYLE_LABELS, type EmailTemplateDef } from "@/lib/emailTemplates";

/** Phase 8: tiny phone mock for a text-thread template card. */
function TextThumb({ tpl }: { tpl: TextTemplateDef }) {
  const cyber = tpl.platform === "cyber";
  const bg = cyber ? "#07070d" : "#fff";
  const self = cyber ? "#002a33" : tpl.platform === "ios" ? "#0a84ff" : "#d3e3fd";
  const other = cyber ? "#140a1c" : tpl.platform === "ios" ? "#e9e9eb" : "#f1f3f4";
  const bubble = (side: "l" | "r", w: string, key: number) => (
    <div key={key} style={{ alignSelf: side === "r" ? "flex-end" : "flex-start", width: w, height: 9,
      background: side === "r" ? self : other,
      border: cyber ? `1px solid ${side === "r" ? "#00e5ff" : "#ff2bd6"}` : "none",
      borderRadius: cyber ? 2 : 6 }} />
  );
  return (
    <div className="absolute inset-0 flex justify-center items-end" style={{ background: cyber ? "#000" : "#dfe3ea" }}>
      <div style={{ width: 92, height: 118, background: bg, borderRadius: "10px 10px 0 0", padding: "8px 7px", display: "flex", flexDirection: "column", gap: 4,
        border: cyber ? "1px solid #00e5ff66" : "1px solid #c8ccd4", borderBottom: "none" }}>
        <div style={{ fontSize: 6, fontFamily: cyber ? "'Share Tech Mono',monospace" : "sans-serif", color: cyber ? "#00e5ff" : "#111", letterSpacing: cyber ? 1 : 0, marginBottom: 2 }}>
          {cyber ? "FIXER // ENCRYPTED" : tpl.platform === "ios" ? "Crew" : "Back Alley Boys"}
        </div>
        {[["l", "70%"], ["l", "55%"], ["r", "60%"], ["l", "75%"], ["r", "45%"]].map(([s, w], i) => bubble(s as "l" | "r", w, i))}
      </div>
    </div>
  );
}

function TextTemplateCard({ tpl }: { tpl: TextTemplateDef }) {
  return (
    <Link href={`/build/text/${tpl.id}`} data-testid={`card-template-${tpl.id}`}>
      <a className="group block border border-card-border bg-card hover-elevate overflow-hidden hud-panel">
        <div className="h-32 border-b border-card-border relative overflow-hidden"><TextThumb tpl={tpl} /></div>
        <div className="p-3">
          <div className="font-semibold text-sm uppercase tracking-wide" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{tpl.name}</div>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{tpl.description}</p>
          <p className="text-[10px] uppercase tracking-widest text-primary/80 mt-1.5">{PLATFORM_LABELS[tpl.platform]}</p>
        </div>
      </a>
    </Link>
  );
}

/** Phase 9: tiny mail-window mock for an email template card. */
function EmailThumb({ tpl }: { tpl: EmailTemplateDef }) {
  const { settings } = tpl.build();
  const term = tpl.style === "terminal";
  const web = tpl.style === "webmail";
  const a = settings.accent;
  const line = (w: string, key: number) => (
    <span key={key} style={{ display: "block", height: 3, width: w, background: term ? `${a}66` : "#d6d9de", borderRadius: 1 }} />
  );
  return (
    <div className="absolute inset-0 flex justify-center items-end" style={{ background: term ? "#000" : "#dfe3ea" }}>
      <div style={{ width: 150, height: 108, background: term ? "#050806" : web ? "#fffdf7" : "#f3f4f6", border: term ? `1px solid ${a}88` : "1px solid #c8ccd4", borderBottom: "none", borderRadius: web ? "8px 8px 0 0" : 0, overflow: "hidden" }}>
        <div style={{ background: term ? "#0b120d" : web ? `linear-gradient(90deg, ${a}, #8e44ad)` : a, color: term ? a : "#fff", fontSize: 6, padding: "3px 6px", fontFamily: term ? "'Share Tech Mono',monospace" : "sans-serif", letterSpacing: term ? 1 : 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {settings.clientName}
        </div>
        {settings.classification && (
          <div style={{ background: term ? "transparent" : "#b91c1c", color: term ? a : "#fff", fontSize: 4.5, textAlign: "center", letterSpacing: 1, padding: "1px 0" }}>{settings.classification.slice(0, 32)}</div>
        )}
        <div style={{ padding: "5px 7px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 6.5, fontWeight: 700, color: term ? a : "#111", fontFamily: term ? "'Share Tech Mono',monospace" : "sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{settings.subject}</div>
          {[0, 1].map((k) => (
            <div key={k} style={{ background: term ? "#08100a" : "#fff", border: term ? `1px solid ${a}55` : "1px solid #e1e4e8", borderRadius: web ? 4 : 0, padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              {line("40%", 0)}{line("95%", 1)}{line("70%", 2)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailTemplateCard({ tpl }: { tpl: EmailTemplateDef }) {
  return (
    <Link href={`/build/email/${tpl.id}`} data-testid={`card-template-${tpl.id}`}>
      <a className="group block border border-card-border bg-card hover-elevate overflow-hidden hud-panel">
        <div className="h-32 border-b border-card-border relative overflow-hidden"><EmailThumb tpl={tpl} /></div>
        <div className="p-3">
          <div className="font-semibold text-sm uppercase tracking-wide" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{tpl.name}</div>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{tpl.description}</p>
          <p className="text-[10px] uppercase tracking-widest text-primary/80 mt-1.5">{EMAIL_STYLE_LABELS[tpl.style]}</p>
        </div>
      </a>
    </Link>
  );
}

const NCT_NAV = ["GOSSIP", "OPINION", "WEATHER", "TECH", "LIFESTYLE", "LOCAL", "BIZ", "WORLD"];

function NctThumb({ active }: { active: string }) {
  // active comes in like "BUSINESS"; map to short nav label
  const activeShort = active === "BUSINESS" ? "BIZ" : active;
  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: "#fff", color: "#111", padding: "8px 10px", fontFamily: "'Roboto Slab',serif" }}
    >
      {/* masthead */}
      <div className="flex items-center justify-between" style={{ borderBottom: "2px solid #111", paddingBottom: 3 }}>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontStyle: "italic", fontWeight: 900, fontSize: 11, color: "#111", letterSpacing: "0.5px" }}>
          NIGHT CITY TODAY
        </span>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 6, color: "#c0392b" }}>● 12:00 AM</span>
      </div>
      {/* nav strip with active desk highlighted */}
      <div className="flex gap-[3px] flex-wrap" style={{ marginTop: 4 }}>
        {NCT_NAV.map((c) => (
          <span
            key={c}
            style={{
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
              fontSize: 6,
              padding: "1px 3px",
              borderRadius: 1,
              background: c === activeShort ? "#c0392b" : "transparent",
              color: c === activeShort ? "#fff" : "#555",
            }}
          >
            {c}
          </span>
        ))}
      </div>
      {/* desk headline + body bars */}
      <div style={{ marginTop: 6 }}>
        <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 9, lineHeight: 1.05, color: "#111", textTransform: "uppercase" }}>
          {active} DESK <span style={{ color: "#c0392b" }}>// FRONT PAGE</span>
        </div>
        <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          {["96%", "100%", "82%"].map((w, i) => (
            <span key={i} style={{ height: 2, width: w, background: "#cfcfcf", borderRadius: 1 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ id, name, description, active }: { id: string; name: string; description: string; active?: string }) {
  const isOptic = id === "augmented-optic";
  const isCustom = id === "custom";
  return (
    <Link href={`/build/${id}`} data-testid={`card-template-${id}`}>
      <a className="group block border border-card-border bg-card hover-elevate overflow-hidden hud-panel">
        <div
          className="h-32 flex items-center justify-center border-b border-card-border relative overflow-hidden"
          style={{
            background: isOptic
              ? "#000"
              : isCustom
              ? "linear-gradient(135deg,hsl(220 32% 8%),hsl(216 24% 16%))"
              : "#fff",
          }}
        >
          {isOptic ? (
            <span style={{ fontFamily: "'Special Elite',monospace", color: "#fff", fontSize: 22 }}>The Optic 👁</span>
          ) : isCustom ? (
            <span className="text-primary" style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: "0.05em" }}>+ CUSTOM</span>
          ) : (
            <NctThumb active={active || "NEWS"} />
          )}
        </div>
        <div className="p-3">
          <div className="font-semibold text-sm uppercase tracking-wide" style={{ fontFamily: "'Rajdhani',sans-serif" }}>{name}</div>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{description}</p>
        </div>
      </a>
    </Link>
  );
}

/** Template grid: NCT desks first, then other outlets. Each card links to /build/:id. */
export default function TemplatePicker() {
  const nctTemplates = TEMPLATES.filter((t) => t.branding.logoStyle === "nct");
  const otherTemplates = TEMPLATES.filter((t) => t.branding.logoStyle !== "nct");
  return (
      <section className="mb-12">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Newspaper className="w-4 h-4" /> Night City Today desks
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {nctTemplates.map((t) => (
            <TemplateCard key={t.id} id={t.id} name={t.name} description={t.description} active={t.settings.activeCategory} />
          ))}
        </div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Other outlets</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {otherTemplates.map((t) => (
            <TemplateCard key={t.id} id={t.id} name={t.name} description={t.description} />
          ))}
        </div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-8 mb-4 flex items-center gap-2" data-testid="heading-text-threads">
          <MessageSquare className="w-4 h-4" /> Text threads
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {TEXT_TEMPLATES.map((t) => <TextTemplateCard key={t.id} tpl={t} />)}
        </div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mt-8 mb-4 flex items-center gap-2" data-testid="heading-email-threads">
          <Mail className="w-4 h-4" /> Email threads
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {EMAIL_TEMPLATES.map((t) => <EmailTemplateCard key={t.id} tpl={t} />)}
        </div>
      </section>
  );
}
