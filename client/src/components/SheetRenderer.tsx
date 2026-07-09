import React, { forwardRef } from "react";
import type { Branding, SheetSettings, Block, TwoColumnSlot } from "@shared/schema";

type Props = {
  branding: Branding;
  settings: SheetSettings;
  blocks: Block[];
};

// --- Inline logo treatments ---------------------------------------------

function NCTLogo({ color = "#7b5ea7" }: { color?: string }) {
  // Stylized "NCT" speed-streak mark with orbit ring, evoking the template.
  return (
    <svg width="160" height="74" viewBox="0 0 160 74" aria-label="NCT logo" role="img">
      <defs>
        <linearGradient id="nctgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5aa9e6" />
          <stop offset="50%" stopColor="#8e6bd1" />
          <stop offset="100%" stopColor="#d05fb0" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="34" rx="74" ry="26" fill="none" stroke="url(#nctgrad)" strokeWidth="3" transform="rotate(-12 80 34)" />
      <g fill="url(#nctgrad)" fontFamily="'Orbitron', sans-serif" fontWeight="900">
        <text x="80" y="48" textAnchor="middle" fontSize="40" letterSpacing="2" fontStyle="italic">NCT</text>
      </g>
      <g stroke="url(#nctgrad)" strokeWidth="2.5">
        <line x1="20" y1="30" x2="48" y2="30" />
        <line x1="16" y1="38" x2="44" y2="38" />
        <line x1="22" y1="46" x2="50" y2="46" />
      </g>
      <text x="80" y="68" textAnchor="middle" fontSize="9" fill={color} fontFamily="'Rajdhani',sans-serif" fontWeight="700" letterSpacing="2">NIGHT CITY TODAY</text>
    </svg>
  );
}

function OpticEye() {
  return (
    <svg width="88" height="62" viewBox="0 0 88 62" aria-label="The Augmented Optic eye" role="img">
      {/* radiating triangles */}
      <g fill="#fff">
        {Array.from({ length: 18 }).map((_, i) => {
          const a = (i / 18) * Math.PI * 2;
          const x1 = 44 + Math.cos(a) * 26;
          const y1 = 31 + Math.sin(a) * 18;
          const x2 = 44 + Math.cos(a - 0.12) * 32;
          const y2 = 31 + Math.sin(a - 0.12) * 22;
          const x3 = 44 + Math.cos(a + 0.12) * 32;
          const y3 = 31 + Math.sin(a + 0.12) * 22;
          return <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} />;
        })}
      </g>
      <ellipse cx="44" cy="31" rx="26" ry="15" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="44" cy="31" r="10" fill="none" stroke="#fff" strokeWidth="2.5" />
      <polygon points="44,24 50,28 50,34 44,38 38,34 38,28" fill="#fff" />
    </svg>
  );
}

// --- Block renderer ------------------------------------------------------

function BlockView({ block, idx }: { block: Block; idx: number }) {
  switch (block.type) {
    case "headline":
      return (
        <h1 className={block.size === "lead" ? "ss-headline-lead" : "ss-headline-section"}>
          {block.text || "\u00a0"}
        </h1>
      );
    case "byline":
      return <div className="ss-byline">{block.author} &nbsp;|&nbsp; {block.dateline}</div>;
    case "paragraph":
      return (
        <p className="ss-para" style={idx === 0 ? {} : {}}>
          {block.text || "\u00a0"}
        </p>
      );
    case "image": {
      const pos = block.position ?? "inline";
      const style: React.CSSProperties =
        pos === "above-headline" ? { columnSpan: "all", width: "100%", marginBottom: 12 } :
        pos === "float-right"    ? { float: "right", width: "40%", margin: "0 0 8px 12px", clear: "right" } :
        pos === "float-left"     ? { float: "left",  width: "40%", margin: "0 12px 8px 0", clear: "left" } :
        {};
      return (
        <figure className="ss-figure">
          {block.src ? (
            <img src={block.src} alt={block.caption} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: "100%", height: 220, border: "3px dashed #111", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Share Tech Mono',monospace", color: "#888" }}>
              [ NO IMAGE ]
            </div>
          )}
          {block.caption && <figcaption className="ss-caption">{block.caption}</figcaption>}
        </figure>
      );
    }
    case "pullquote":
      return (
        <blockquote className="ss-pullquote">
          &ldquo;{block.text}&rdquo;
          {block.attribution && <span className="ss-attr">{block.attribution}</span>}
        </blockquote>
      );
    case "ad":
      return (
        <div className="ss-ad"
          style={{
            backgroundColor: block.bgColor ?? undefined,
            backgroundImage: block.bgImage ? `url(${block.bgImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}>
          <div className="ss-ad-body">{block.text}</div>
          {block.sponsor && <div className="ss-ad-sponsor">{block.sponsor}</div>}
        </div>
      );
    case "sidebar":
      return (
        <aside className="ss-sidebar">
          <div className="ss-sb-head">{block.heading}</div>
          <div className="ss-sb-text">{block.text}</div>
        </aside>
      );
    case "brief":
      return (
        <div className="ss-brief">
          <div className="ss-brief-head">{block.heading}</div>
          <div className="ss-brief-text">{block.text}</div>
        </div>
      );
    case "divider":
      return <hr className="ss-divider" />;
    case "two-column":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TwoColSlot slot={block.left} />
          <TwoColSlot slot={block.right} />
        </div>
      );
  }
}

// --- Masthead ------------------------------------------------------------

function StatusBar({ settings, headerText }: { settings: SheetSettings; headerText: string }) {
  return (
    <div className="ss-statusbar" style={{ color: headerText, background: "#fff" }}>
      <span aria-hidden>📡</span>
      <span className="ss-clock">{settings.clock}</span>
      <span aria-hidden>🔌</span>
    </div>
  );
}

const SheetRenderer = forwardRef<HTMLDivElement, Props>(({ branding, settings, blocks }, ref) => {
  const isOptic = branding.logoStyle === "optic";

  return (
    <div className="screamsheet" ref={ref} data-sheet>
      <StatusBar settings={settings} headerText="#111" />

      {isOptic ? (
        <div className="ss-tabloid-masthead" style={{ background: branding.headerBg, color: branding.headerText }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <OpticEye />
          </div>
          <div className="ss-tabloid-title">{branding.outlet}</div>
          {branding.tagline && (
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 13, letterSpacing: 3, marginTop: 6 }}>
              {branding.tagline}
            </div>
          )}
        </div>
      ) : (
        <div className="ss-masthead" style={{ background: branding.headerBg, color: branding.headerText }}>
          <div style={{ flexShrink: 0 }}>
            {branding.logoStyle === "nct" ? (
              <NCTLogo />
              ) : branding.logoStyle === "custom-image" && branding.logoSrc ? (
                  <img
                    src={branding.logoSrc}
                    alt={branding.outlet}
                    crossOrigin="anonymous"
                    style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain" }}
                  />
              ) : (
              <div style={{ lineHeight: 1 }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 26, color: branding.accent }}>
                  {branding.outlet}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: 2, color: branding.headerText }}>
                  {branding.tagline}
                </div>
              </div>
            )}
          </div>
          {settings.showNav && settings.categories.length > 0 && (
            <div className="ss-nav">
              {settings.categories.map((cat) => {
                const active = cat === settings.activeCategory;
                return (
                  <div
                    key={cat}
                    className="ss-tab"
                    style={{ background: active ? branding.accent : "#111", color: "#fff" }}
                  >
                    {cat}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {settings.ticker && <div className="ss-ticker">▸ {settings.ticker}</div>}

      <div className="ss-body" style={{
        columnCount: settings.columns ?? 1,
        columnGap: 24,
        columnFill: "auto",
      }}>
        {blocks.length === 0 ? (
          <p className="ss-para" style={{ textAlign: "center", color: "#999" }}>
            Add content blocks to build your screamsheet.
          </p>
        ) : (
          blocks.map((b, i) => <BlockView key={b.id} block={b} idx={i} />)
        )}
      </div>
    </div>
  );
});

SheetRenderer.displayName = "SheetRenderer";

// ------------------------- Two Column function --------------------------------
function TwoColSlot({ slot }: { slot: TwoColumnSlot }) {
  if (slot.kind === "image") {
    return (
      <figure style={{ margin: 0 }}>
        {slot.src ? (
          <img src={slot.src} alt={slot.caption} crossOrigin="anonymous"
            style={{
              width: "100%", height: "auto", display: "block"}} />
        ) : (
            <div style={{ width: "100%", height: 160, border: "3px dashed #111", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Share Tech Mono',monospace", color: "#888" }}>
              [ NO IMAGE ]
            </div>
        )}
        {slot.caption && <figcaption className="ss-caption">{slot.caption}</figcaption>}
      </figure>
    );
    }
  return <p className="ss-para" style={{ margin: 0 }}>{slot.content || "\u00a0"}</p>;
}
export default SheetRenderer;
