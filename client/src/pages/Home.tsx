import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Artifact } from "@shared/artifact";
import TemplatePicker from "@/components/builder/TemplatePicker";
import { getGmKey, setGmKey, clearGmKey } from "@/lib/gmKey";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ExternalLink, Plus, KeyRound, LogOut, ShieldCheck, Pencil, CopyPlus } from "lucide-react";

type LibraryFilter = "all" | "sheet" | "textThread";
const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sheet", label: "Sheets" },
  { id: "textThread", label: "Texts" },
];
const TYPE_BADGE: Record<Artifact["type"], string> = { sheet: "Sheet", textThread: "Text", emailThread: "Email" };

/** Where Edit / Duplicate go for each artifact type. */
function builderPath(a: Artifact): string {
  return a.type === "textThread" ? `/build/text/${a.template}` : `/build/${a.template}`;
}
function cardSubtitle(a: Artifact): string {
  if (a.type === "sheet") return a.branding.outlet;
  if (a.type === "textThread") return a.headerTitle || `${a.messages.length} messages`;
  return a.subject || a.clientName;
}

export default function Home() {
  const { toast } = useToast();

  // GM key state — gates the private library. Seeded from guarded storage.
  const [gmKey, setGmKeyState] = useState<string>(() => getGmKey());
  const [draftKey, setDraftKey] = useState<string>("");
  const hasKey = gmKey.length > 0;
  const [filter, setFilter] = useState<LibraryFilter>("all");

  const unlock = () => {
    const k = draftKey.trim();
    if (!k) return;
    setGmKey(k);
    setGmKeyState(k);
    setDraftKey("");
    queryClient.invalidateQueries({ queryKey: ["/api/screamsheets"] });
    toast({ title: "Library unlocked", description: "Showing screamsheets saved with this GM key." });
  };

  const lock = () => {
    clearGmKey();
    setGmKeyState("");
    queryClient.removeQueries({ queryKey: ["/api/screamsheets"] });
    toast({ title: "Library locked", description: "Your GM key was cleared from this device." });
  };

  // Only fetch the library when a key is present, and scope it by ?owner=.
  const { data: items, isLoading, isError, error, refetch } = useQuery<Artifact[]>({
    queryKey: ["/api/screamsheets", { owner: gmKey }],
    enabled: hasKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/screamsheets?owner=${encodeURIComponent(gmKey)}`);
      return (await res.json()) as Artifact[];
    },
  });
  const sheets = items?.filter((a) => filter === "all" || a.type === filter);

  const del = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/screamsheets/${id}?owner=${encodeURIComponent(gmKey)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/screamsheets"] });
      toast({ title: "Deleted", description: "Screamsheet removed from your library." });
    },
    onError: () => toast({ title: "Delete failed", description: "That sheet isn't tied to your GM key.", variant: "destructive" }),
  });


  return (
    <AppShell>
      {/* Hero */}
      <section className="mb-10 relative border border-card-border bg-card/60 hud-panel hud-brackets px-6 py-6 overflow-hidden">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary mb-3" style={{ fontFamily: "'Share Tech Mono',monospace" }}>
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" /> Night City Press Terminal
        </div>
        <h1 className="text-xl font-bold uppercase tracking-tight max-w-3xl" style={{ fontFamily: "'Orbitron',sans-serif" }}>
          Forge a screamsheet, drop it on your players
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Pick a template, fill in the form, and export a print-ready sheet — or save a shareable link your crew can read in-browser. Built for Cyberpunk tables and any neon-soaked setting.
        </p>
      </section>

      {/* Templates */}
      <TemplatePicker />

      {/* Library */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Your private library
          </h2>
          {hasKey && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1" role="group" aria-label="Filter library" data-testid="library-filters">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    data-testid={`filter-${f.id}`}
                    className={`px-2.5 py-1 text-xs uppercase tracking-widest border transition-colors ${
                      filter === f.id ? "bg-primary text-primary-foreground border-primary" : "border-card-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={lock} data-testid="button-lock-library">
                <LogOut className="w-3.5 h-3.5 mr-1" /> Lock
              </Button>
            </div>
          )}
        </div>

        {!hasKey ? (
          <div className="border border-card-border p-6 hud-panel hud-brackets bg-card/50">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary mb-2" style={{ fontFamily: "'Share Tech Mono',monospace" }}>
              <KeyRound className="w-3.5 h-3.5" /> GM access key
            </div>
            <p className="text-sm text-muted-foreground max-w-xl mb-4">
              Your saved screamsheets are private. Enter your secret GM key to load the sheets tied to it — players who open a shared link never see this library. Use the same key across devices to access the same sheets.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); unlock(); }}
              className="flex flex-col sm:flex-row gap-2 max-w-xl"
            >
              <Input
                type="password"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="Enter or create a GM key…"
                autoComplete="off"
                data-testid="input-gmkey"
              />
              <Button type="submit" disabled={!draftKey.trim()} data-testid="button-unlock-library">
                <KeyRound className="w-4 h-4 mr-1" /> Unlock library
              </Button>
            </form>
            <p className="text-xs text-muted-foreground/70 mt-3">
              New here? Pick any key you'll remember — the sheets you save while it's set will be filed under it.
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-md" />)}
          </div>
        ) : isError ? (
          // A failed request is NOT the same as an empty library — say so.
          <div className="border border-destructive/60 p-6 hud-panel bg-card/40" data-testid="library-error">
            <p className="text-sm font-semibold text-destructive">Couldn't load your library.</p>
            <p className="text-xs text-muted-foreground mt-1 break-all">{(error instanceof Error ? error.message : String(error)).slice(0, 300)}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()} data-testid="button-retry-library">Retry</Button>
          </div>
        ) : items && items.length > 0 && sheets && sheets.length === 0 ? (
          <div className="border border-dashed border-border p-8 text-center hud-panel bg-card/40" data-testid="library-filter-empty">
            <p className="text-muted-foreground text-sm">Nothing of this type yet.</p>
          </div>
        ) : !sheets || sheets.length === 0 ? (
          <div className="border border-dashed border-border p-8 text-center hud-panel bg-card/40">
            <p className="text-muted-foreground text-sm">No screamsheets saved under this GM key yet. Build one and hit Save — it'll be filed under your key.</p>
            <Link href="/build">
              <a><Button className="mt-4" data-testid="button-start-building"><Plus className="w-4 h-4 mr-1" /> Start building</Button></a>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sheets.map((s) => (
              <div key={s.id} className="border border-card-border bg-card p-4 hover-elevate hud-panel" data-testid={`card-saved-${s.id}`} data-artifact-type={s.type}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate" data-testid={`text-title-${s.id}`}>{s.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 min-w-0">
                      <span
                        className="shrink-0 px-1.5 py-px text-[10px] uppercase tracking-widest border border-primary/50 text-primary"
                        data-testid={`badge-type-${s.id}`}
                      >
                        {TYPE_BADGE[s.type]}
                      </span>
                      <span className="truncate">{cardSubtitle(s)}{s.createdAt != null ? ` · ${new Date(s.createdAt).toLocaleDateString()}` : ""}</span>
                    </div>
                  </div>
                  <Button
                    size="icon" variant="ghost"
                    className="shrink-0 text-destructive"
                    onClick={() => del.mutate(s.id)}
                    data-testid={`button-delete-${s.id}`}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href={`${builderPath(s)}?edit=${s.id}`}>
                    <a className="flex-1"><Button size="sm" className="w-full" data-testid={`button-edit-${s.id}`}><Pencil className="w-3.5 h-3.5 mr-1" /> Edit</Button></a>
                  </Link>
                  <Link href={`/s/${s.id}`}>
                    <a className="flex-1"><Button size="sm" variant="outline" className="w-full" data-testid={`button-view-${s.id}`}><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open</Button></a>
                  </Link>
                  <Link href={`${builderPath(s)}?load=${s.id}`}>
                    <a><Button size="sm" variant="secondary" data-testid={`button-duplicate-${s.id}`} aria-label="Duplicate" title="Duplicate as a new copy"><CopyPlus className="w-3.5 h-3.5" /></Button></a>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
