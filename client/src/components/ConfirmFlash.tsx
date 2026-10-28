import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * Phase 7: short animated confirmation ("LINK READY", "PDF EXPORTED").
 * A stamp drops in, holds ~1.4 s, fades. Reduced-motion users get a plain fade.
 * Purely decorative: the toast / status bar still carry the real message.
 */
export function useConfirmFlash(holdMs = 1400) {
  const [flash, setFlash] = useState<{ label: string; sub?: string; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback(
    (label: string, sub?: string) => {
      clearTimeout(timer.current);
      setFlash((f) => ({ label, sub, n: (f?.n ?? 0) + 1 }));
      timer.current = setTimeout(() => setFlash(null), holdMs);
    },
    [holdMs],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return { flash, show };
}

export function ConfirmFlash({ flash }: { flash: { label: string; sub?: string; n: number } | null }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4" aria-hidden>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.n}
            data-testid="confirm-flash"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6, rotate: -8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -3 }}
            exit={{ opacity: 0, y: reduce ? 0 : -12 }}
            transition={{ type: reduce ? "tween" : "spring", stiffness: 520, damping: 22, duration: reduce ? 0.15 : undefined }}
            className="border-2 border-primary bg-background/90 backdrop-blur px-5 py-2 shadow-[0_0_24px_hsl(var(--primary)/0.45)] hud-panel"
          >
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-[0.3em] text-sm" style={{ fontFamily: "'Orbitron',sans-serif" }}>
              <Check className="w-4 h-4" /> {flash.label}
            </div>
            {flash.sub && <div className="text-[11px] text-muted-foreground text-center mt-0.5 tracking-wide">{flash.sub}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
