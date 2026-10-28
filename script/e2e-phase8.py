# Phase 8 browser test: text-message threads end to end.
# Needs `npm run dev` on port 5000 against a data.db seeded by script/seed-legacy.py.
# Prints PASS/FAIL per check and exits 1 on any FAIL.
import json, sqlite3, sys, urllib.request, urllib.error
from playwright.sync_api import sync_playwright
B = "http://localhost:5000/"
fails = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok: fails.append(name)
def db(): return sqlite3.connect("data.db")
def row(id):
    r = db().execute("select title, template, settings, blocks, artifact_type, schema_version, owner_key from screamsheets where id=?", (id,)).fetchone()
    return None if r is None else {"title": r[0], "template": r[1], "settings": json.loads(r[2]), "blocks": json.loads(r[3]), "type": r[4], "version": r[5], "owner": r[6]}
def raw_row(id): return db().execute("select * from screamsheets where id=?", (id,)).fetchone()
def count(): return db().execute("select count(*) from screamsheets").fetchone()[0]
def status(pg): return pg.get_attribute('[data-testid=save-status]', 'data-status')
def drafts(pg): return pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('screamsheet:draft:'))")
def msg_order(pg): return pg.eval_on_selector_all('[data-testid=message-list] [data-msg-id]', "els => els.map(e => e.dataset.msgId)")
def preview_text(pg): return pg.inner_text('[data-testid=pane-preview] [data-testid=text-thread]')
def http(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"content-type": "application/json"})
    try:
        r = urllib.request.urlopen(req); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
def pick(pg, trigger, option_text):
    pg.click(trigger); pg.get_by_role("option", name=option_text, exact=True).click(); pg.wait_for_timeout(200)

legacy_before = raw_row("legacy001")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(B); pg.evaluate("localStorage.clear()"); pg.reload()

    # --- home: text thread templates ---
    pg.wait_for_selector("[data-testid=heading-text-threads]")
    check("home shows a Text threads section", pg.is_visible("[data-testid=heading-text-threads]"))
    for t in ["text-cyber", "text-ios", "text-android"]:
        check(f"template card {t}", pg.locator(f"[data-testid=card-template-{t}]").count() == 1)
    pg.click("[data-testid=card-template-text-android]"); pg.wait_for_selector("[data-testid=text-thread]")
    check("card opens the text builder", "#/build/text/text-android" in pg.url, pg.url)
    check("android template renders material style", pg.get_attribute("[data-testid=text-thread]", "data-platform") == "android")
    check("new thread shows 'not saved yet'", status(pg) == "new", status(pg))
    check("credit line on by default", pg.locator("[data-testid=pane-preview] [data-testid=thread-attribution]").count() == 1)
    check("disclaimer near export", pg.locator("[data-testid=pane-preview] [data-testid=disclaimer-compact]").is_visible())
    check("status only under owner's last message", pg.locator("[data-testid=pane-preview] [data-testid=thread-status]").count() == 1)
    pg.fill("[data-testid=input-title]", "Draft thread"); pg.wait_for_timeout(1200)
    check("draft saved locally for a new thread", "screamsheet:draft:new:text-android" in drafts(pg), str(drafts(pg)))

    # --- builder: start from cyber, with a GM key ---
    pg.evaluate("localStorage.clear(); localStorage.setItem('screamsheet:gmKey','test-gm')")
    pg.goto(B + "#/build/text/text-cyber"); pg.reload(); pg.wait_for_selector("[data-testid=text-thread]")
    check("cyber template renders", pg.get_attribute("[data-testid=text-thread]", "data-platform") == "cyber")
    check("bare /build/text route works", True)
    pg.fill("[data-testid=input-title]", "PRIVATE thread title")
    pg.fill("[data-testid=input-header-title]", "Rogue Fixer")
    pg.fill("[data-testid=input-clock]", "3:33 AM")
    check("header updates live", "ROGUE FIXER" in preview_text(pg))
    check("clock updates live", pg.inner_text("[data-testid=pane-preview] [data-testid=thread-clock]") == "3:33 AM")
    pick(pg, "[data-testid=select-platform]", "Glass (iOS-style)")
    check("style switch to glass", pg.get_attribute("[data-testid=pane-preview] [data-testid=text-thread]", "data-platform") == "ios")
    n_people = pg.locator("[data-testid=participants] [data-testid^=participant-]").count()
    pg.click("[data-testid=button-add-participant]"); pg.wait_for_timeout(200)
    check("add person", pg.locator("[data-testid=participants] [data-testid^=participant-]").count() == n_people + 1)
    new_pid = pg.eval_on_selector_all("[data-testid=participants] [data-testid^=participant-]", "els => els.at(-1).dataset.testid.replace('participant-','')")
    pg.fill(f"[data-testid=input-participant-{new_pid}]", "Ghost")
    n_msgs = len(msg_order(pg))
    pg.click(f"[data-testid=button-add-msg-{new_pid}]"); pg.wait_for_timeout(200)
    mid = msg_order(pg)[-1]
    check("add message from new person", len(msg_order(pg)) == n_msgs + 1)
    pg.fill(f"[data-testid=input-body-{mid}]", "BOO FROM THE NET")
    check("new message renders", "BOO FROM THE NET" in preview_text(pg))
    check("group chat shows sender name", "Ghost" in preview_text(pg))
    pg.click("[data-testid=button-add-msg-system]"); pg.wait_for_timeout(200)
    check("system note added", "New system note" in preview_text(pg))

    # --- save ---
    before = count()
    pg.click("[data-testid=button-save]")
    pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000)
    share = pg.input_value("[data-testid=input-sharelink]")
    tid = share.rstrip("/").split("/")[-1]
    check("save creates one row", count() == before + 1)
    check("share link uses /s/:id", "/s/" in share and "#" not in share, share)
    r = row(tid)
    check("row is a v1 textThread", r and r["type"] == "textThread" and r["version"] == 1, str(r and (r["type"], r["version"])))
    check("row template is the style preset", r["template"] == "text-cyber", r["template"])
    check("row settings carry platform + people", r["settings"]["platform"] == "ios" and any(x["name"] == "Ghost" for x in r["settings"]["participants"]))
    check("row blocks are the messages", any(m.get("body") == "BOO FROM THE NET" for m in r["blocks"]))
    check("row filed under GM key", r["owner"] == "test-gm")
    check("confirm flash shows", pg.locator("[data-testid=confirm-flash]").count() >= 1)

    # --- autosave + reorder ---
    pg.fill(f"[data-testid=input-body-{mid}]", "AUTOSAVED BOO"); pg.wait_for_timeout(300)
    check("edit marks unsaved", status(pg) == "unsaved", status(pg))
    pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000)
    check("autosave wrote the edit", any(m.get("body") == "AUTOSAVED BOO" for m in row(tid)["blocks"]))
    order0 = msg_order(pg)
    h = pg.locator(f"[data-testid=drag-{order0[0]}]"); h.scroll_into_view_if_needed()
    h.focus(); pg.keyboard.press("Space"); pg.wait_for_timeout(150)
    pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(150)
    pg.keyboard.press("Space"); pg.wait_for_timeout(400)
    order1 = msg_order(pg)
    check("keyboard drag reorders messages", order1[:2] == [order0[1], order0[0]], f"{order0[:3]} -> {order1[:3]}")
    pg.click(f"[data-testid=button-up-{order1[1]}]"); pg.wait_for_timeout(200)
    check("up button works", msg_order(pg)[:2] == order0[:2])
    pg.click(f"[data-testid=button-dup-{order0[0]}]"); pg.wait_for_timeout(200)
    check("duplicate inserts below", len(msg_order(pg)) == len(order0) + 1 and msg_order(pg)[0] == order0[0])
    dup = msg_order(pg)[1]
    pg.click(f"[data-testid=button-remove-{dup}]"); pg.wait_for_timeout(200)
    check("delete removes it", msg_order(pg) == order0)
    pg.click(f"[data-testid=button-down-{order0[0]}]"); pg.wait_for_timeout(200)
    final_order = msg_order(pg)
    pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000)
    pg.wait_for_timeout(300)
    check("new order autosaved", [m["id"] for m in row(tid)["blocks"]] == final_order)

    # --- phone owner + remove person ---
    pg.check(f"[data-testid=radio-self-{new_pid}]"); pg.wait_for_timeout(200)
    check("phone owner switch", row(tid) is not None and pg.is_checked(f"[data-testid=radio-self-{new_pid}]"))
    pg.click(f"[data-testid=button-remove-participant-{new_pid}]"); pg.wait_for_timeout(300)
    check("removing a person removes their messages", "AUTOSAVED BOO" not in preview_text(pg))
    pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000); pg.wait_for_timeout(300)
    s = row(tid)["settings"]
    check("owner falls back to a remaining person", s["selfId"] in [x["id"] for x in s["participants"]] and s["selfId"] != new_pid)

    # --- exports ---
    with pg.expect_download() as dl: pg.click("[data-testid=button-export-png]")
    check("PNG export", dl.value.suggested_filename.endswith(".png"), dl.value.suggested_filename)
    with pg.expect_download() as dl: pg.click("[data-testid=button-export-pdf]")
    check("PDF export", dl.value.suggested_filename.endswith(".pdf"), dl.value.suggested_filename)

    # --- reload edit link ---
    pg.goto(B + f"#/build/text/text-cyber?edit={tid}"); pg.reload(); pg.wait_for_timeout(1500)
    check("edit link loads as saved", status(pg) == "saved", status(pg))
    check("edit link restores content", pg.input_value("[data-testid=input-header-title]") == "Rogue Fixer")
    check("editing banner says thread", "thread" in pg.inner_text("[data-testid=banner-editing]").lower())

    # --- wrong builder for the type ---
    pg.goto(B + f"#/build/nct-tech?edit={tid}"); pg.reload(); pg.wait_for_timeout(1500)
    check("sheet builder refuses a thread", "cannot edit a textThread" in pg.inner_text("body"))

    # --- public view ---
    pg.goto(B + f"#/s/{tid}"); pg.wait_for_selector("[data-testid=view-main][data-state=ready]", timeout=8000)
    check("view renders a text thread", pg.get_attribute("[data-testid=view-main]", "data-artifact-type") == "textThread")
    check("view shows header", "ROGUE FIXER" not in pg.inner_text("[data-testid=text-thread]") and "Rogue Fixer" in pg.inner_text("[data-testid=text-thread]"))
    check("view shows credit line", pg.locator("[data-testid=thread-attribution]").count() == 1)
    check("view footer disclaimer", pg.locator("[data-testid=view-footer] [data-testid=disclaimer]").count() == 1)
    with pg.expect_download() as dl: pg.click("[data-testid=button-view-png]")
    check("view PNG export", dl.value.suggested_filename.endswith(".png"))

    # --- share HTML ---
    code, html = http("GET", B + f"s/{tid}")
    check("/s/:id 200 for thread", code == 200, str(code))
    check("/s/:id og:title uses header", 'og:title" content="Messages with Rogue Fixer' in html)
    check("/s/:id hides private title", "PRIVATE thread title" not in html)

    # --- library ---
    pg.goto(B); pg.wait_for_selector(f"[data-testid=card-saved-{tid}]", timeout=8000)
    check("thread in library", pg.is_visible(f"[data-testid=card-saved-{tid}]"))
    check("type badge Text", pg.inner_text(f"[data-testid=badge-type-{tid}]").lower() == "text")
    check("legacy badge Sheet", pg.inner_text("[data-testid=badge-type-legacy001]").lower() == "sheet")
    pg.click("[data-testid=filter-textThread]"); pg.wait_for_timeout(200)
    check("Texts filter hides sheets", pg.locator("[data-testid=card-saved-legacy001]").count() == 0 and pg.is_visible(f"[data-testid=card-saved-{tid}]"))
    pg.click("[data-testid=filter-sheet]"); pg.wait_for_timeout(200)
    check("Sheets filter hides threads", pg.locator(f"[data-testid=card-saved-{tid}]").count() == 0 and pg.is_visible("[data-testid=card-saved-legacy001]"))
    pg.click("[data-testid=filter-all]"); pg.wait_for_timeout(200)
    check("All shows both", pg.locator("[data-testid^=card-saved-]").count() >= 2)
    edit_href = pg.get_attribute(f"[data-testid=card-saved-{tid}] a:has([data-testid=button-edit-{tid}])", "href")
    check("edit link goes to text builder", f"/build/text/text-cyber?edit={tid}" in (edit_href or ""), str(edit_href))
    pg.click(f"[data-testid=button-duplicate-{tid}]"); pg.wait_for_selector("[data-testid=text-thread]"); pg.wait_for_timeout(1500)
    check("duplicate opens a copy", pg.input_value("[data-testid=input-title]").endswith("(copy)"))
    before = count()
    pg.click("[data-testid=button-save]"); pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000)
    copy_id = pg.input_value("[data-testid=input-sharelink]").rstrip("/").split("/")[-1]
    check("duplicate saves a new thread row", count() == before + 1 and copy_id != tid and row(copy_id)["type"] == "textThread")

    # --- API type guard ---
    sheet_body = {"title": "x", "template": "nct-tech", "branding": {"outlet": "A", "tagline": "", "accent": "#c0392b", "headerBg": "#fff", "headerText": "#111", "logoStyle": "nct"},
                  "settings": {"clock": "1", "categories": [], "activeCategory": "", "showNav": False, "ticker": "", "columns": 1}, "blocks": []}
    code, _ = http("PUT", B + f"api/screamsheets/{tid}?owner=test-gm", sheet_body)
    check("PUT sheet onto thread -> 409", code == 409, str(code))
    t_body = {"title": "x", "template": "text-cyber", "branding": {}, "settings": row(tid)["settings"], "blocks": row(tid)["blocks"], "artifactType": "textThread", "schemaVersion": 1}
    code, _ = http("PUT", B + "api/screamsheets/legacy001?owner=test-gm", t_body)
    check("PUT thread onto legacy sheet -> 409", code == 409, str(code))
    code, _ = http("PUT", B + f"api/screamsheets/{tid}?owner=intruder", t_body)
    check("wrong GM key -> 403", code == 403, str(code))

    # --- mobile ---
    m = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mp = m.new_page()
    mp.goto(B + "#/build/text/text-ios"); mp.wait_for_selector("[data-testid=mobile-tabs]")
    check("mobile tabs visible", mp.is_visible("[data-testid=mobile-tabs]"))
    mp.click("[data-testid=tab-preview]"); mp.wait_for_timeout(300)
    check("mobile preview shows phone", mp.locator("[data-testid=pane-preview] [data-testid=text-thread]").is_visible())
    w = mp.evaluate("document.documentElement.scrollWidth")
    check("mobile builder has no sideways scroll", w <= 390, str(w))
    mp.screenshot(path="/tmp/p8-mobile-builder.png", full_page=True)
    mp.goto(B + f"#/s/{tid}"); mp.wait_for_selector("[data-testid=view-main][data-state=ready]", timeout=8000); mp.wait_for_timeout(600)
    w = mp.evaluate("document.documentElement.scrollWidth")
    check("mobile view fits the screen", w <= 390, str(w))
    mp.screenshot(path="/tmp/p8-mobile-view.png", full_page=True)

    real = [e for e in errors if "validateDOMNesting" not in e]
    check("no page errors", not real, str(real[:2]))
    br.close()

check("legacy001 row unchanged", raw_row("legacy001") == legacy_before)
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
