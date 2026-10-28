# Phase 7 browser test: public view states, share links with preview tags,
# disclaimer + credit line, confirmation flash, drag-and-drop, print preview.
# Needs `npm run dev` on port 5000 against a data.db seeded by script/seed-legacy.py.
# Prints PASS/FAIL per check and exits 1 on any FAIL.
import json, sqlite3, sys, urllib.request, urllib.error
from playwright.sync_api import sync_playwright
B = "http://localhost:5000/"
fails = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok: fails.append(name)
def state(pg): return pg.get_attribute('[data-testid=view-main]', 'data-state')
def db_blocks(id):
    return json.loads(sqlite3.connect("data.db").execute("select blocks from screamsheets where id=?", (id,)).fetchone()[0])
def get(url):
    try:
        r = urllib.request.urlopen(url); return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
def order(pg):
    return pg.eval_on_selector_all('[data-testid=block-list] [data-block-id]', "els => els.map(e => e.dataset.blockId)")

# --- share path: link-preview HTML (no browser) ---
code, html = get(B + "s/legacy001")
check("/s/:id returns 200", code == 200, str(code))
check("/s/:id has per-sheet og:title", 'og:title" content="LEGACY HEADLINE | NIGHT CITY TODAY"' in html)
check("/s/:id never leaks the private title", "Legacy Sheet" not in html)
check("/s/:id has default og:image", "/og-default.png" in html)
check("/s/:id redirects to the hash route", 'url=/#/s/legacy001' in html)
code, html = get(B + "s/doesnotexist")
check("/s/<missing> returns 404 with not-found meta", code == 404 and "Screamsheet not found" in html, str(code))
code, _ = get(B + "s/bad%20id")
check("/s/<invalid id> returns 404", code == 404, str(code))
code, html = get(B + "s/broken001")
check("/s/<corrupt row> still redirects", code == 200 and "url=/#/s/broken001" in html, str(code))
code, _ = get(B + "og-default.png")
check("og-default.png is served", code == 200, str(code))

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.goto(B); pg.evaluate("localStorage.clear()")

    # --- public view states ---
    pg.goto(B + "s/legacy001"); pg.wait_for_selector("[data-sheet]", timeout=10000)
    check("share path lands on the player view", pg.url.endswith("#/s/legacy001"), pg.url)
    check("view state is ready", state(pg) == "ready", state(pg))
    check("full disclaimer in footer", "not affiliated" in pg.inner_text("[data-testid=disclaimer]"))
    check("'made with' link in footer", pg.is_visible("[data-testid=link-made-with]"))
    check("legacy sheet has no credit line", pg.locator("[data-testid=sheet-attribution]").count() == 0)

    pg.goto(B + "#/s/doesnotexist"); pg.wait_for_selector("[data-testid=view-error-notfound]", timeout=10000)
    check("missing sheet -> 404 state", state(pg) == "notfound")
    check("404 state has no retry", pg.locator("[data-testid=button-view-retry]").count() == 0)
    check("404 state links home", pg.is_visible("[data-testid=button-view-home]"))

    pg.goto(B + "#/s/broken001"); pg.wait_for_selector("[data-testid=view-error-unreadable]", timeout=10000)
    check("corrupt sheet -> unreadable (500) state", state(pg) == "unreadable")
    check("unreadable state offers retry", pg.is_visible("[data-testid=button-view-retry]"))

    # offline, then recover with Try again
    pg.route("**/api/screamsheets/legacy001", lambda r: r.abort())
    pg.goto(B + "#/s/legacy001"); pg.reload(); pg.wait_for_selector("[data-testid=view-error-network]", timeout=10000)
    check("network failure -> offline state", state(pg) == "network")
    pg.unroute("**/api/screamsheets/legacy001")
    pg.click("[data-testid=button-view-retry]"); pg.wait_for_selector("[data-sheet]", timeout=10000)
    check("Try again recovers", state(pg) == "ready")

    # slow response shows the loading skeleton
    def slow(route):
        pg.wait_for_timeout(1200); route.continue_()
    pg.route("**/api/screamsheets/legacy001", slow)
    pg.goto(B); pg.goto(B + "#/s/legacy001")
    pg.wait_for_selector("[data-testid=view-loading]", timeout=3000)
    check("loading state shown while fetching", state(pg) == "loading")
    pg.wait_for_selector("[data-sheet]", timeout=10000)
    pg.unroute("**/api/screamsheets/legacy001")

    with pg.expect_download() as dl:
        pg.click("[data-testid=button-view-png]")
    check("view PNG export downloads", dl.value.suggested_filename.endswith(".png"))
    pg.wait_for_selector("[data-testid=confirm-flash]", timeout=3000)
    check("export shows confirmation flash", "png exported" in pg.inner_text("[data-testid=confirm-flash]").lower())
    pg.wait_for_timeout(2200)
    check("flash goes away on its own", pg.locator("[data-testid=confirm-flash]").count() == 0)

    # --- builder: credit line, disclaimer, share link format, flash ---
    pg.goto(B + "#/build/nct-tech"); pg.wait_for_selector("[data-sheet]")
    check("compact disclaimer under preview", pg.is_visible("[data-testid=disclaimer-compact]"))
    check("new sheet: credit switch on", pg.get_attribute("[data-testid=switch-attribution]", "data-state") == "checked")
    check("new sheet: credit line rendered", pg.locator("[data-testid=sheet-attribution]").count() == 1)
    pg.click("[data-testid=switch-attribution]"); pg.wait_for_timeout(200)
    check("toggle off hides credit line", pg.locator("[data-testid=sheet-attribution]").count() == 0)
    pg.click("[data-testid=switch-attribution]"); pg.wait_for_timeout(200)
    pg.evaluate("localStorage.setItem('screamsheet:gmKey','test-gm')"); pg.reload(); pg.wait_for_selector("[data-sheet]")
    banner = pg.locator("[data-testid=button-discard-draft]")
    if banner.count(): banner.click()
    pg.click("[data-testid=button-save]")
    pg.wait_for_selector("[data-testid=confirm-flash]", timeout=5000)
    check("save & share shows 'link ready' flash", "link ready" in pg.inner_text("[data-testid=confirm-flash]").lower())
    link = pg.input_value("[data-testid=input-sharelink]")
    check("share link uses /s/:id path", "/s/" in link and "#" not in link, link)
    new_id = link.rsplit("/", 1)[1]
    code, html = get(link)
    check("new share link serves preview tags", code == 200 and "CORPO COUP ROCKS WATSON DISTRICT" in html, str(code))
    stored = json.loads(sqlite3.connect("data.db").execute("select settings from screamsheets where id=?", (new_id,)).fetchone()[0])
    check("credit setting saved with the sheet", stored.get("showAttribution") is True)

    # --- drag and drop (now editing the saved sheet; autosave is on) ---
    pg.wait_for_timeout(500)
    before = order(pg)
    check("grip handle on every block", pg.locator("[data-testid^=drag-]").count() == len(before), f"{len(before)} blocks")
    h = pg.locator(f"[data-testid=drag-{before[0]}]")
    h.focus(); pg.keyboard.press("Space"); pg.wait_for_timeout(150)
    pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(150)
    pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(150)
    pg.keyboard.press("Space"); pg.wait_for_timeout(400)
    after_kb = order(pg)
    check("keyboard drag moves first block down two", after_kb == before[1:3] + [before[0]] + before[3:], f"{before} -> {after_kb}")

    pg.locator(f"[data-testid=drag-{after_kb[0]}]").scroll_into_view_if_needed()
    src = pg.locator(f"[data-testid=drag-{after_kb[1]}]").bounding_box()
    dst = pg.locator(f"[data-testid=drag-{after_kb[0]}]").bounding_box()
    pg.mouse.move(src["x"] + src["width"] / 2, src["y"] + src["height"] / 2); pg.mouse.down()
    for i in range(1, 21):
        pg.mouse.move(src["x"] + src["width"] / 2, src["y"] + (dst["y"] - src["y"]) * i / 20 - 4); pg.wait_for_timeout(15)
    pg.mouse.up(); pg.wait_for_timeout(400)
    after_mouse = order(pg)
    check("mouse drag moves second block to the top", after_mouse[:2] == [after_kb[1], after_kb[0]], f"{after_kb} -> {after_mouse}")
    pg.click(f"[data-testid=button-down-{after_mouse[0]}]"); pg.wait_for_timeout(200)
    after_btn = order(pg)
    check("up/down buttons still work", after_btn[1] == after_mouse[0])
    pg.wait_for_selector('[data-testid=save-status][data-status=saved]', timeout=8000)
    check("reorder is autosaved in the new order", [b["id"] for b in db_blocks(new_id)] == after_btn)
    pg.wait_for_selector("[data-testid=input-title]")
    check("inputs still typeable (drag only from the grip)", True)
    pg.fill(f"[data-testid=input-headline-{[b for b in after_btn if pg.locator(f'[data-testid=input-headline-{b}]').count()][0]}]", "DRAGGED HEADLINE")
    pg.wait_for_timeout(200)
    check("typing in a block still works", "DRAGGED HEADLINE" in pg.inner_text("[data-sheet]"))

    # --- print preview ---
    pg.click("[data-testid=preview-mode-print]"); pg.wait_for_selector("[data-testid=print-page]")
    bb = pg.locator("[data-testid=print-page]").bounding_box()
    check("print page is US Letter shaped", abs(bb["height"] / bb["width"] - 792 / 612) < 0.01, f"{bb['width']:.0f}x{bb['height']:.0f}")
    check("short sheet fits at full width", pg.get_attribute("[data-testid=print-note]", "data-shrunk") == "false")
    sb = pg.locator("[data-sheet]").bounding_box()
    check("sheet spans the page width", abs(sb["width"] - bb["width"]) < 2, f"{sb['width']:.0f} vs {bb['width']:.0f}")
    for _ in range(30): pg.click("[data-testid=button-add-paragraph]")
    pg.wait_for_timeout(500)
    check("long sheet: note says it shrinks", pg.get_attribute("[data-testid=print-note]", "data-shrunk") == "true" and "shrinks it to" in pg.inner_text("[data-testid=print-note]"))
    sb = pg.locator("[data-sheet]").bounding_box()
    check("long sheet fits page height", sb["height"] <= bb["height"] + 2 and sb["width"] < bb["width"] - 10, f"{sb['width']:.0f}x{sb['height']:.0f}")
    with pg.expect_download() as dl:
        pg.click("[data-testid=button-export-pdf]")
    check("PDF export works in print mode", dl.value.suggested_filename.endswith(".pdf"))
    pg.click("[data-testid=preview-mode-screen]"); pg.wait_for_timeout(200)
    check("back to screen preview", pg.get_attribute("[data-testid=preview-box]", "data-mode") == "screen")

    # --- legacy sheet in the builder: credit stays off ---
    pg.goto(B + "#/build/nct-tech?edit=legacy001"); pg.reload(); pg.wait_for_timeout(1500)
    check("legacy sheet: credit switch off", pg.get_attribute("[data-testid=switch-attribution]", "data-state") == "unchecked")
    check("legacy sheet still loads clean", pg.get_attribute("[data-testid=save-status]", "data-status") == "saved")

    # --- mobile ---
    m = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mp = m.new_page()
    mp.goto(B + "#/s/doesnotexist"); mp.wait_for_selector("[data-testid=view-error-notfound]", timeout=10000)
    w = mp.evaluate("document.documentElement.scrollWidth")
    check("mobile 404 state fits the screen", w <= 390, str(w))
    mp.goto(B + "s/legacy001"); mp.wait_for_selector("[data-sheet]", timeout=10000)
    check("mobile footer disclaimer visible", mp.locator("[data-testid=disclaimer]").is_visible())
    mp.screenshot(path="/tmp/p7-mobile-view.png", full_page=True)
    mp.goto(B + "#/s/broken001"); mp.wait_for_selector("[data-testid=view-error-unreadable]", timeout=10000)
    mp.screenshot(path="/tmp/p7-mobile-error.png")
    pg.goto(B + f"#/build/nct-tech?edit={new_id}"); pg.wait_for_selector("[data-sheet]"); pg.wait_for_timeout(800)
    pg.click("[data-testid=preview-mode-print]"); pg.wait_for_timeout(400)
    pg.screenshot(path="/tmp/p7-desktop-print.png")
    br.close()

print("\nALL PASS" if not fails else f"\n{len(fails)} FAILED: {fails}")
sys.exit(1 if fails else 0)
