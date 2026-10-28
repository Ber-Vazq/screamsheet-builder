import { DISCLAIMER_FULL, DISCLAIMER_SHORT, ATTRIBUTION_TEXT } from "@shared/legalCopy";
import { Link } from "wouter";
import { Info } from "lucide-react";

/** Phase 7: fictional/parody notice. `compact` is the one-liner used near export buttons. */
export function ParodyDisclaimer({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <p
      className={`text-[11px] leading-snug text-muted-foreground flex items-start gap-1.5 ${className}`}
      data-testid={compact ? "disclaimer-compact" : "disclaimer"}
    >
      <Info className="w-3 h-3 mt-[2px] shrink-0" aria-hidden />
      <span>{compact ? `${DISCLAIMER_SHORT} Share responsibly.` : DISCLAIMER_FULL}</span>
    </p>
  );
}

/** Phase 7: subtle credit + way back to the builder, shown under public views. */
export function MadeWithLink() {
  return (
    <Link href="/">
      <a
        className="text-[11px] uppercase tracking-[0.15em] sm:tracking-[0.25em] text-muted-foreground hover:text-primary transition-colors"
        style={{ fontFamily: "'Share Tech Mono',monospace" }}
        data-testid="link-made-with"
      >
        {ATTRIBUTION_TEXT} · make your own →
      </a>
    </Link>
  );
}
