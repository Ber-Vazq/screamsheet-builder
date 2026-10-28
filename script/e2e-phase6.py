# Phase 6 browser test: save status, autosave, failed saves, draft recovery, mobile tabs.
# Needs `npm run dev` on port 5000 against a data.db seeded by script/seed-legacy.py.
# Prints PASS/FAIL per check and exits 1 on any FAIL.
import json, os, sqlite3, sys, tempfile
from playwright.sync_api import sync_playwright
B = "http://localhost:5000/"
fails = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok: fails.append(name)
def row(id):
    return sqlite3.connect("data.db").execute("select title, settings, schema_version, updated_at from screamsheets where id=?", (id,)).fetchone()
def count():
    return sqlite3.connect("data.db").execute("select count(*) from screamsheets").fetchone()[0]
def status(pg): return pg.get_attribute('[data-testid=save-status]', 'data-status')
def drafts(pg): return pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('screamsheet:draft:'))")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())  # accept "leave page?" prompts on reload
    pg.goto(B); pg.evaluate("localStorage.clear()"); pg.reload()

    # --- new sheet, no GM key ---
    pg.goto(B + "#/build/nct-tech"); pg.wait_for_selector('[data-testid=save-status]')
    check("fresh template shows 'not saved yet'", status(pg) == "new", status(pg))
    check("hint explains autosave needs a GM key", "GM key" in pg.inner_text('[data-testid=save-status-hint]'))
    check("mobile tabs hidden on desktop", not pg.is_visible('[data-testid=mobile-tabs]'))
    n = count()
    pg.fill('[data-testid=input-title]', 'Draft Title 1'); pg.wait_for_timeout(300)
    check("typing marks unsaved", status(pg) == "unsaved")
    pg.wait_for_timeout(3000)
    check("no autosave without a saved sheet", count() == n)
    check("draft written locally", "screamsheet:draft:new:nct-tech" in drafts(pg), str(drafts(pg)))

    # --- draft recovery for a new sheet ---
    pg.reload(); pg.wait_for_selector('[data-testid=banner-draft]', timeout=5000)
    check("reload offers to restore", pg.is_visible('[data-testid=banner-draft]'))
    check("title is back to default before restore", pg.input_value('[data-testid=input-title]') != 'Draft Title 1')
    pg.click('[data-testid=button-restore-draft]'); pg.wait_for_timeout(300)
    check("restore brings edits back", pg.input_value('[data-testid=input-title]') == 'Draft Title 1')
    check("restored edits count as unsaved", status(pg) == "unsaved")
    pg.wait_for_timeout(1200); pg.reload(); pg.wait_for_selector('[data-testid=banner-draft]', timeout=5000)
    pg.click('[data-testid=button-discard-draft]'); pg.wait_for_timeout(300)
    check("discard hides banner", not pg.is_visible('[data-testid=banner-draft]'))
    pg.reload(); pg.wait_for_timeout(1500)
    check("discarded draft stays gone", not pg.is_visible('[data-testid=banner-draft]') and drafts(pg) == [])

    # --- autosave on a saved legacy sheet ---
    pg.evaluate("localStorage.setItem('screamsheet:gmKey','test-gm')")
    pg.goto(B + "#/build/nct-tech?edit=legacy001"); pg.reload(); pg.wait_for_timeout(1500)
    check("saved sheet loads as 'saved'", status(pg) == "saved", status(pg))
    check("hint says autosave on", "Autosave on" in pg.inner_text('[data-testid=save-status-hint]'))
    check("no restore prompt for a clean sheet", not pg.is_visible('[data-testid=banner-draft]'))
    pg.fill('[data-testid=input-title]', 'Autosaved Title'); pg.wait_for_timeout(300)
    check("edit shows unsaved/autosaving", status(pg) == "unsaved" and "autosaving" in pg.inner_text("[data-testid=save-status-text]").lower())
    pg.wait_for_timeout(1000)
    check("no save before 2 s idle", row("legacy001")[0] != 'Autosaved Title')
    pg.wait_for_timeout(2500)
    r = row("legacy001")
    check("autosave wrote the row", r[0] == 'Autosaved Title', str(r[0]))
    check("autosave kept Release A (still legacy)", r[2] is None)
    check("status shows saved just now", status(pg) == "saved" and "just now" in pg.inner_text("[data-testid=save-status-text]").lower())
    check("draft cleared after save", drafts(pg) == [], str(drafts(pg)))

    # --- failed autosave -> error + Retry, draft survives reload ---
    pg.route("**/api/screamsheets/legacy001*", lambda route: route.abort() if route.request.method == "PUT" else route.continue_())
    pg.fill('[data-testid=input-ticker]', 'OFFLINE EDIT'); pg.wait_for_timeout(3500)
    check("failed save shows error", status(pg) == "error", status(pg))
    check("retry button visible", pg.is_visible('[data-testid=button-retry-save]'))
    check("draft kept while save fails", "screamsheet:draft:legacy001" in drafts(pg))
    check("server unchanged", "OFFLINE EDIT" not in row("legacy001")[1])
    pg.wait_for_timeout(2500)
    check("no retry loop while nothing changed", status(pg) == "error")
    pg.reload(); pg.wait_for_selector('[data-testid=banner-draft]', timeout=5000)
    check("reload after failure offers the draft", pg.is_visible('[data-testid=banner-draft]'))
    pg.click('[data-testid=button-restore-draft]'); pg.wait_for_timeout(300)
    check("restored ticker", pg.input_value('[data-testid=input-ticker]') == 'OFFLINE EDIT')
    pg.unroute("**/api/screamsheets/legacy001*")
    pg.wait_for_timeout(3500)  # restored edits are dirty -> autosave now succeeds
    check("autosave succeeds once back online", "OFFLINE EDIT" in row("legacy001")[1] and status(pg) == "saved", status(pg))
    # manual retry path
    pg.route("**/api/screamsheets/legacy001*", lambda route: route.abort() if route.request.method == "PUT" else route.continue_())
    pg.fill('[data-testid=input-title]', 'Retry Title'); pg.wait_for_timeout(3500)
    pg.unroute("**/api/screamsheets/legacy001*")
    pg.click('[data-testid=button-retry-save]'); pg.wait_for_timeout(1500)
    check("Retry button saves", row("legacy001")[0] == 'Retry Title' and status(pg) == "saved")

    # --- stale draft (older than the server) is not offered ---
    pg.evaluate("""localStorage.setItem('screamsheet:draft:legacy001', JSON.stringify({v:1,savedAt:1,hash:'old',imagesStripped:false,
      sheet:{type:'sheet',title:'Ancient',blocks:[],branding:{},settings:{categories:[]}}}))""")
    pg.reload(); pg.wait_for_timeout(1500)
    check("draft older than server isn't offered", not pg.is_visible('[data-testid=banner-draft]'))

    # --- create, then autosave takes over ---
    pg.goto(B + "#/build/custom"); pg.wait_for_timeout(1200)
    check("hint: autosave starts after first save", "after the first save" in pg.inner_text('[data-testid=save-status-hint]'))
    pg.fill('[data-testid=input-title]', 'P6 Created'); pg.click('[data-testid=button-save]')
    pg.wait_for_selector('[data-testid=input-sharelink]'); new_id = pg.input_value('[data-testid=input-sharelink]').split('/s/')[1]
    pg.wait_for_timeout(500)
    check("after create: saved", status(pg) == "saved")
    pg.fill('[data-testid=input-title]', 'P6 Created then autosaved'); pg.wait_for_timeout(3500)
    check("autosave after create", row(new_id)[0] == 'P6 Created then autosaved' and row(new_id)[2] == 1)

    # --- big image: local backup drops images ---
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(b"\x89PNG\r\n\x1a\n" + os.urandom(3_500_000)); big = f.name
    pg.goto(B + "#/build/nct-tech"); pg.wait_for_timeout(1200)
    pg.click('[data-testid=button-add-image]'); pg.wait_for_timeout(200)
    pg.locator('[data-testid^=input-imagefile-]').last.set_input_files(big); pg.wait_for_timeout(2500)
    check("oversized backup notes images were dropped", "without images" in pg.inner_text('[data-testid=save-status-hint]'), pg.inner_text('[data-testid=save-status-hint]'))
    stored = pg.evaluate("localStorage.getItem('screamsheet:draft:new:nct-tech') || ''")
    check("stored draft has no base64", stored != "" and "data:" not in stored and '"imagesStripped":true' in stored, f"{len(stored)} chars")
    pg.reload(); pg.wait_for_selector('[data-testid=banner-draft]', timeout=5000)
    check("restore banner warns about images", "re-added" in pg.inner_text('[data-testid=banner-draft]'))
    pg.click('[data-testid=button-discard-draft]')

    # --- mobile ---
    m = br.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True, is_mobile=True, has_touch=True)
    mp = m.new_page(); mp.on("dialog", lambda d: d.accept())
    mp.goto(B + "#/build/nct-tech"); mp.wait_for_selector('[data-testid=mobile-tabs]')
    check("mobile tabs visible", mp.is_visible('[data-testid=mobile-tabs]'))
    box = mp.locator('[data-testid=pane-preview]').bounding_box()
    check("preview off-screen on Edit tab", box is not None and box["x"] < -1000, str(box and box["x"]))
    check("editor visible on Edit tab", mp.is_visible('[data-testid=input-title]'))
    with mp.expect_download() as d: mp.click('[data-testid=button-export-png]')
    check("PNG export works from Edit tab", d.value.suggested_filename.endswith(".png"))
    mp.click('[data-testid=tab-preview]'); mp.wait_for_timeout(400)
    box = mp.locator('[data-testid=pane-preview]').bounding_box()
    check("Preview tab shows preview", box is not None and box["x"] >= 0 and box["width"] > 300, str(box))
    check("Preview tab hides editor", not mp.is_visible('[data-testid=input-title]'))
    sw = mp.evaluate("document.documentElement.scrollWidth")
    check("no horizontal scroll on phone", sw <= 392, str(sw))
    mp.screenshot(path="/tmp/p6-mobile-preview.png")
    mp.click('[data-testid=tab-edit]'); mp.wait_for_timeout(300)
    check("save status visible on phone", mp.is_visible('[data-testid=save-status]'))
    mp.screenshot(path="/tmp/p6-mobile-edit.png")
    pg.goto(B + "#/build/nct-tech?edit=legacy001"); pg.wait_for_timeout(1500); pg.screenshot(path="/tmp/p6-desktop.png")
    br.close()

print("\nALL PASS" if not fails else f"\n{len(fails)} FAIL: {fails}")
sys.exit(1 if fails else 0)
