# Phase 9 browser test: email threads end to end.
# Needs `npm run dev` on port 5000 against a data.db seeded by script/seed-legacy.py.
# Prints PASS/FAIL per check and exits 1 on any FAIL.
import json, sqlite3, sys, urllib.request, urllib.error
from playwright.sync_api import sync_playwright
B = "http://localhost:5000/"
PACKS = ["email-arasaka-legal", "email-militech-ops", "email-gang-spam", "email-fixer-intel", "email-clinic-notice"]
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
def preview(pg): return pg.inner_text('[data-testid=pane-preview] [data-testid=email-thread]')
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

    # --- home: email template packs ---
    pg.wait_for_selector("[data-testid=heading-email-threads]")
    check("home shows an Email threads section", pg.is_visible("[data-testid=heading-email-threads]"))
    check("text threads section still there", pg.is_visible("[data-testid=heading-text-threads]"))
    for t in PACKS:
        check(f"template card {t}", pg.locator(f"[data-testid=card-template-{t}]").count() == 1)
    pg.click("[data-testid=card-template-email-militech-ops]"); pg.wait_for_selector("[data-testid=email-thread]")
    check("card opens the email builder", "#/build/email/email-militech-ops" in pg.url, pg.url)
    check("militech pack uses the terminal look", pg.get_attribute("[data-testid=pane-preview] [data-testid=email-thread]", "data-style") == "terminal")
    check("new thread shows 'not saved yet'", status(pg) == "new", status(pg))
    check("credit line on by default", pg.locator("[data-testid=pane-preview] [data-testid=email-attribution]").count() == 1)
    check("disclaimer near export", pg.locator("[data-testid=pane-preview] [data-testid=disclaimer-compact]").is_visible())
    check("classification banner shows", "NOFORN" in pg.inner_text("[data-testid=pane-preview] [data-testid=email-classification]"))
    check("attachments render", pg.locator("[data-testid=pane-preview] [data-testid=email-attachment]").count() >= 2)
    check("flag renders", pg.locator("[data-testid=pane-preview] [data-testid=email-flag]").count() >= 1)
    check("quoted text renders", pg.locator("[data-testid=pane-preview] [data-testid=email-quoted]").count() >= 1)
    pg.fill("[data-testid=input-title]", "Draft email"); pg.wait_for_timeout(1200)
    check("draft saved locally for a new email", "screamsheet:draft:new:email-militech-ops" in drafts(pg), str(drafts(pg)))

    # --- each pack renders without errors ---
    for t in PACKS:
        pg.goto(B + f"#/build/email/{t}"); pg.wait_for_selector("[data-testid=pane-preview] [data-testid=email-thread]")
        n = pg.locator("[data-testid=pane-preview] [data-testid=email-message]").count()
        check(f"{t} renders its emails", n >= 1 and n == len(msg_order(pg)), str(n))
    pg.goto(B + "#/build/email"); pg.wait_for_selector("[data-testid=email-thread]")
    check("bare /build/email falls back to the first pack", pg.input_value("[data-testid=input-title]").startswith("Arasaka"))

    # --- builder with a GM key ---
    pg.evaluate("localStorage.clear(); localStorage.setItem('screamsheet:gmKey','test-gm')")
    pg.goto(B + "#/build/email/email-arasaka-legal"); pg.reload(); pg.wait_for_selector("[data-testid=email-thread]")
    check("arasaka pack uses the corporate look", pg.get_attribute("[data-testid=pane-preview] [data-testid=email-thread]", "data-style") == "corporate")
    pg.fill("[data-testid=input-title]", "PRIVATE email title")
    pg.fill("[data-testid=input-subject]", "Final Warning: Shard AR-77")
    pg.fill("[data-testid=input-client-name]", "ZETATECH INTRANET")
    pg.fill("[data-testid=input-mailbox]", "v@zeta.corp")
    pg.fill("[data-testid=input-classification]", "")
    check("subject updates live", "Final Warning: Shard AR-77" in preview(pg))
    check("client name updates live", pg.inner_text("[data-testid=pane-preview] [data-testid=email-client-name]") == "ZETATECH INTRANET")
    check("empty banner hides it", pg.locator("[data-testid=pane-preview] [data-testid=email-classification]").count() == 0)
    pick(pg, "[data-testid=select-style]", "Free webmail")
    check("style switch to webmail", pg.get_attribute("[data-testid=pane-preview] [data-testid=email-thread]", "data-style") == "webmail")
    order0 = msg_order(pg)
    last = order0[-1]
    pg.click("[data-testid=button-add-reply]"); pg.wait_for_timeout(200)
    order = msg_order(pg); rid = order[-1]
    check("add reply appends an email", len(order) == len(order0) + 1)
    check("reply subject gets RE:", pg.input_value(f"[data-testid=input-msg-subject-{rid}]").lower().startswith("re:"))
    check("reply goes back to the last sender", pg.input_value(f"[data-testid=input-to-{rid}]") == pg.input_value(f"[data-testid=input-from-addr-{last}]"))
    check("reply is pre-quoted", pg.input_value(f"[data-testid=input-quoted-{rid}]") != "")
    pg.fill(f"[data-testid=input-from-name-{rid}]", "Jan Kowalski")
    pg.fill(f"[data-testid=input-body-{rid}]", "FINE. IT'S IN THE LOCKER.")
    pg.fill(f"[data-testid=input-cc-{rid}]", "mom@home.nc, ")
    check("typing a trailing comma is kept", pg.input_value(f"[data-testid=input-cc-{rid}]") == "mom@home.nc, ")
    pg.fill(f"[data-testid=input-cc-{rid}]", "mom@home.nc, lawyer@nc.law")
    pg.fill(f"[data-testid=input-attachments-{rid}]", "locker_key.jpg\nmap.png")
    pg.click(f"[data-testid=switch-flag-{rid}]")
    pv = preview(pg)
    check("new reply renders", "FINE. IT'S IN THE LOCKER." in pv)
    check("cc renders", "lawyer@nc.law" in pv)
    check("reply attachments render", "locker_key.jpg" in pv and "map.png" in pv)
    pg.click("[data-testid=button-add-email]"); pg.wait_for_timeout(200)
    bid = msg_order(pg)[-1]
    pg.fill(f"[data-testid=input-body-{bid}]", "")
    pg.click(f"[data-testid=button-quote-prev-{bid}]"); pg.wait_for_timeout(150)
    check("quote previous copies the email above", "FINE. IT'S IN THE LOCKER." in pg.input_value(f"[data-testid=input-quoted-{bid}]"))
    pg.click(f"[data-testid=button-remove-{bid}]"); pg.wait_for_timeout(150)
    check("remove email", bid not in msg_order(pg))

    # --- save ---
    before = count()
    pg.click("[data-testid=button-save]")
    pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000)
    share = pg.input_value("[data-testid=input-sharelink]")
    eid = share.rstrip("/").split("/")[-1]
    check("save creates one row", count() == before + 1)
    check("share link uses /s/:id", "/s/" in share and "#" not in share, share)
    r = row(eid)
    check("row is a v1 emailThread", r and r["type"] == "emailThread" and r["version"] == 1, str(r and (r["type"], r["version"])))
    check("row template is the pack id", r["template"] == "email-arasaka-legal", r["template"])
    check("row settings carry style + subject", r["settings"]["style"] == "webmail" and r["settings"]["subject"] == "Final Warning: Shard AR-77")
    saved_reply = next((m for m in r["blocks"] if m["id"] == rid), None)
    check("row blocks are the emails", saved_reply is not None and saved_reply["body"] == "FINE. IT'S IN THE LOCKER.")
    check("cc saved as a list", saved_reply and saved_reply["cc"] == ["mom@home.nc", "lawyer@nc.law"], str(saved_reply and saved_reply["cc"]))
    check("attachments saved as a list", saved_reply and saved_reply["attachments"] == ["locker_key.jpg", "map.png"])
    check("flag saved", saved_reply and saved_reply["flagged"] is True)
    check("row filed under GM key", r["owner"] == "test-gm")
    check("confirm flash shows", pg.locator("[data-testid=confirm-flash]").count() >= 1)

    # --- autosave + reorder ---
    pg.fill(f"[data-testid=input-body-{rid}]", "AUTOSAVED REPLY"); pg.wait_for_timeout(300)
    check("edit marks unsaved", status(pg) == "unsaved", status(pg))
    pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000)
    check("autosave wrote the edit", any(m.get("body") == "AUTOSAVED REPLY" for m in row(eid)["blocks"]))
    order0 = msg_order(pg)
    h = pg.locator(f"[data-testid=drag-{order0[0]}]"); h.scroll_into_view_if_needed()
    h.focus(); pg.keyboard.press("Space"); pg.wait_for_timeout(150)
    pg.keyboard.press("ArrowDown"); pg.wait_for_timeout(150)
    pg.keyboard.press("Space"); pg.wait_for_timeout(400)
    order1 = msg_order(pg)
    check("keyboard drag reorders emails", order1[:2] == [order0[1], order0[0]], f"{order0[:3]} -> {order1[:3]}")
    pg.click(f"[data-testid=button-up-{order1[1]}]"); pg.wait_for_timeout(200)
    check("up button works", msg_order(pg)[:2] == order0[:2])
    pg.click(f"[data-testid=button-dup-{order0[0]}]"); pg.wait_for_timeout(200)
    check("duplicate inserts below", len(msg_order(pg)) == len(order0) + 1 and msg_order(pg)[0] == order0[0])
    dup = msg_order(pg)[1]
    pg.click(f"[data-testid=button-remove-{dup}]"); pg.wait_for_timeout(200)
    check("delete removes it", msg_order(pg) == order0)
    pg.click(f"[data-testid=button-down-{order0[0]}]"); pg.wait_for_timeout(200)
    final_order = msg_order(pg)
    check("preview follows the new order", pg.eval_on_selector_all("[data-testid=pane-preview] [data-testid=email-message]", "els => els.map(e => e.dataset.msgId)") == final_order)
    pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000); pg.wait_for_timeout(300)
    check("new order autosaved", [m["id"] for m in row(eid)["blocks"]] == final_order)

    # --- exports ---
    with pg.expect_download() as dl: pg.click("[data-testid=button-export-png]")
    check("PNG export", dl.value.suggested_filename.endswith(".png"), dl.value.suggested_filename)
    with pg.expect_download() as dl: pg.click("[data-testid=button-export-pdf]")
    check("PDF export", dl.value.suggested_filename.endswith(".pdf"), dl.value.suggested_filename)

    # --- reload edit link ---
    pg.goto(B + f"#/build/email/email-arasaka-legal?edit={eid}"); pg.reload(); pg.wait_for_timeout(1500)
    check("edit link loads as saved", status(pg) == "saved", status(pg))
    check("edit link restores content", pg.input_value("[data-testid=input-subject]") == "Final Warning: Shard AR-77")
    check("editing banner says thread", "thread" in pg.inner_text("[data-testid=banner-editing]").lower())

    # --- wrong builder for the type ---
    pg.goto(B + f"#/build/text/text-cyber?edit={eid}"); pg.reload(); pg.wait_for_timeout(1500)
    check("text builder refuses an email", "cannot edit a emailthread" in pg.inner_text("body").lower() or "emailthread" in pg.inner_text("body").lower())
    pg.goto(B + f"#/build/nct-tech?edit={eid}"); pg.reload(); pg.wait_for_timeout(1500)
    check("sheet builder refuses an email", "emailthread" in pg.inner_text("body").lower())

    # --- public view ---
    pg.goto(B + f"#/s/{eid}"); pg.wait_for_selector("[data-testid=view-main][data-state=ready]", timeout=8000)
    check("view renders an email thread", pg.get_attribute("[data-testid=view-main]", "data-artifact-type") == "emailThread")
    vt = pg.inner_text("[data-testid=email-thread]")
    check("view shows subject", "Final Warning: Shard AR-77" in vt)
    check("view hides private title", "PRIVATE email title" not in pg.inner_text("body"))
    check("view shows credit line", pg.locator("[data-testid=email-attribution]").count() == 1)
    check("view footer disclaimer", pg.locator("[data-testid=view-footer] [data-testid=disclaimer]").count() == 1)
    check("tab title uses subject", "Final Warning" in pg.title(), pg.title())
    with pg.expect_download() as dl: pg.click("[data-testid=button-view-png]")
    check("view PNG export", dl.value.suggested_filename.endswith(".png"))
    with pg.expect_download() as dl: pg.click("[data-testid=button-view-pdf]")
    check("view PDF export", dl.value.suggested_filename.endswith(".pdf"))

    # --- share HTML ---
    code, html = http("GET", B + f"s/{eid}")
    check("/s/:id 200 for email", code == 200, str(code))
    check("/s/:id og:title uses subject", 'og:title" content="Final Warning: Shard AR-77' in html)
    check("/s/:id hides private title", "PRIVATE email title" not in html)

    # --- library ---
    pg.goto(B); pg.wait_for_selector(f"[data-testid=card-saved-{eid}]", timeout=8000)
    check("email in library", pg.is_visible(f"[data-testid=card-saved-{eid}]"))
    check("type badge Email", pg.inner_text(f"[data-testid=badge-type-{eid}]").lower() == "email")
    pg.click("[data-testid=filter-emailThread]"); pg.wait_for_timeout(200)
    check("Emails filter hides sheets", pg.locator("[data-testid=card-saved-legacy001]").count() == 0 and pg.is_visible(f"[data-testid=card-saved-{eid}]"))
    pg.click("[data-testid=filter-textThread]"); pg.wait_for_timeout(200)
    check("Texts filter hides emails", pg.locator(f"[data-testid=card-saved-{eid}]").count() == 0)
    pg.click("[data-testid=filter-all]"); pg.wait_for_timeout(200)
    edit_href = pg.get_attribute(f"[data-testid=card-saved-{eid}] a:has([data-testid=button-edit-{eid}])", "href")
    check("edit link goes to email builder", f"/build/email/email-arasaka-legal?edit={eid}" in (edit_href or ""), str(edit_href))
    pg.click(f"[data-testid=button-duplicate-{eid}]"); pg.wait_for_selector("[data-testid=email-thread]"); pg.wait_for_timeout(1500)
    check("duplicate opens a copy", pg.input_value("[data-testid=input-title]").endswith("(copy)"))
    before = count()
    pg.click("[data-testid=button-save]"); pg.wait_for_selector("[data-testid=save-status][data-status=saved]", timeout=8000)
    copy_id = pg.input_value("[data-testid=input-sharelink]").rstrip("/").split("/")[-1]
    check("duplicate saves a new email row", count() == before + 1 and copy_id != eid and row(copy_id)["type"] == "emailThread")

    # --- API type guard + validation ---
    sheet_body = {"title": "x", "template": "nct-tech", "branding": {"outlet": "A", "tagline": "", "accent": "#c0392b", "headerBg": "#fff", "headerText": "#111", "logoStyle": "nct"},
                  "settings": {"clock": "1", "categories": [], "activeCategory": "", "showNav": False, "ticker": "", "columns": 1}, "blocks": []}
    code, _ = http("PUT", B + f"api/screamsheets/{eid}?owner=test-gm", sheet_body)
    check("PUT sheet onto email -> 409", code == 409, str(code))
    e_body = {"title": "x", "template": "email-arasaka-legal", "branding": {}, "settings": row(eid)["settings"], "blocks": row(eid)["blocks"], "artifactType": "emailThread", "schemaVersion": 1}
    code, _ = http("PUT", B + "api/screamsheets/legacy001?owner=test-gm", e_body)
    check("PUT email onto legacy sheet -> 409", code == 409, str(code))
    code, _ = http("PUT", B + f"api/screamsheets/{eid}?owner=intruder", e_body)
    check("wrong GM key -> 403", code == 403, str(code))
    n = count()
    code, _ = http("POST", B + "api/screamsheets", {**e_body, "ownerKey": "test-gm", "settings": {**e_body["settings"], "style": "nope"}})
    check("bad style -> 400, nothing written", code == 400 and count() == n, str(code))

    # --- mobile ---
    m = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mp = m.new_page()
    mp.goto(B + "#/build/email/email-gang-spam"); mp.wait_for_selector("[data-testid=mobile-tabs]")
    check("mobile tabs visible", mp.is_visible("[data-testid=mobile-tabs]"))
    mp.click("[data-testid=tab-preview]"); mp.wait_for_timeout(300)
    check("mobile preview shows the email", mp.locator("[data-testid=pane-preview] [data-testid=email-thread]").is_visible())
    sc = float(mp.get_attribute("[data-testid=email-preview-fit]", "data-scale") or "1")
    check("mobile preview scales the email down", sc < 1, str(sc))
    w = mp.evaluate("document.documentElement.scrollWidth")
    check("mobile builder has no sideways scroll", w <= 390, str(w))
    mp.goto(B + f"#/s/{eid}"); mp.wait_for_selector("[data-testid=view-main][data-state=ready]", timeout=8000); mp.wait_for_timeout(600)
    w = mp.evaluate("document.documentElement.scrollWidth")
    check("mobile view fits the screen", w <= 390, str(w))
    mp.screenshot(path="/tmp/p9-mobile-view.png", full_page=True)

    real = [e for e in errors if "validateDOMNesting" not in e]
    check("no page errors", not real, str(real[:2]))
    br.close()

check("legacy001 row unchanged", raw_row("legacy001") == legacy_before)
print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAIL'}")
sys.exit(1 if fails else 0)
