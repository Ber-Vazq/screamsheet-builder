import { Link } from "wouter";
import { Newspaper } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";

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
      </section>
  );
}
