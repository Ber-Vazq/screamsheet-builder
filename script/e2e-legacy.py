# Phase 4/5 smoke test: legacy rows keep working, and saves write the right format.
# Needs `npm run dev` on port 5000 against a data.db seeded by script/seed-legacy.py.
#   Release A (default):           python script/e2e-legacy.py
#   Release B (VITE_UPGRADE_ON_SAVE=true npm run dev):  EXPECT_UPGRADE=1 python script/e2e-legacy.py
# Prints PASS/FAIL per check and exits 1 on any FAIL.
import json, os, sqlite3, sys
from playwright.sync_api import sync_playwright
B = "http://localhost:5000/"
UPGRADE = os.environ.get("EXPECT_UPGRADE") == "1"
fails = []
def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok: fails.append(name)
def row(id):
    return sqlite3.connect("data.db").execute(
        "select title, artifact_type, schema_version, owner_key, updated_at from screamsheets where id=?", (id,)).fetchone()
def share_id(pg):
    pg.wait_for_selector('[data-testid=input-sharelink]')
    return pg.input_value('[data-testid=input-sharelink]').split('/s/')[1]

original = row("legacy001")
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page()
    pg.goto(B); pg.evaluate("localStorage.setItem('screamsheet:gmKey','test-gm')")
    pg.reload(); pg.wait_for_timeout(1500)
    html = pg.content()
    check("library shows legacy sheet, hides broken row", "Legacy Sheet" in html and "Broken" not in html)
    pg.goto(B + "#/s/legacy001"); pg.wait_for_timeout(1500)
    check("old share link renders", "LEGACY HEADLINE" in pg.content())
    pg.goto(B + "#/s/broken001"); pg.wait_for_timeout(1500)
    check("broken share link shows error state", "LEGACY HEADLINE" not in pg.content())

    # Duplicate (save as copy) -> new id, v1, original untouched
    pg.goto(B + "#/build/nct-tech?load=legacy001"); pg.wait_for_timeout(1500)
    pg.click('[data-testid=button-save]'); copy_id = share_id(pg)
    check("copy gets a new id", copy_id != "legacy001", copy_id)
    check("copy row is v1", row(copy_id)[1:3] == ("sheet", 1), str(row(copy_id)))
    check("copy keeps GM key", row(copy_id)[3] == "test-gm")
    check("original untouched by copy", row("legacy001") == original)

    # Overwrite legacy -> same id; Release A stays legacy, Release B upgrades
    pg.goto(B + "#/build/nct-tech?edit=legacy001"); pg.wait_for_timeout(1500)
    check("edit loads legacy", pg.input_value('[data-testid=input-ticker]') == "LEGACY TICKER")
    pg.fill('[data-testid=input-title]', 'Legacy Sheet edited'); pg.click('[data-testid=button-save]')
    check("overwrite keeps id", share_id(pg) == "legacy001")
    pg.wait_for_timeout(500)
    r = row("legacy001")
    expected = ("sheet", 1) if UPGRADE else (None, None)
    check(f"row after overwrite is {'v1 (Release B)' if UPGRADE else 'still legacy (Release A)'}", r[1:3] == expected, str(r[:3]))
    check("overwrite keeps GM key + sets updated_at", r[3] == "test-gm" and isinstance(r[4], int))
    # Second save in the same session must not change format unexpectedly
    pg.fill('[data-testid=input-title]', 'Legacy Sheet edited twice'); pg.click('[data-testid=button-save]'); pg.wait_for_timeout(800)
    check("second save keeps format", row("legacy001")[1:3] == expected)

    pg.goto(B + "#/s/legacy001"); pg.wait_for_timeout(1500)
    check("share link still renders after save", "LEGACY HEADLINE" in pg.content())

    # Brand-new sheet -> v1, then update stays v1
    pg.goto(B + "#/build/nct-tech"); pg.wait_for_selector('[data-testid=input-title]')
    pg.fill('[data-testid=input-title]', 'Phase5 New'); pg.click('[data-testid=button-save]'); new_id = share_id(pg)
    check("new sheet row is v1", row(new_id)[1:3] == ("sheet", 1), str(row(new_id)))
    pg.fill('[data-testid=input-title]', 'Phase5 New v2'); pg.click('[data-testid=button-save]'); pg.wait_for_timeout(800)
    check("updating a new sheet keeps v1 and id", row(new_id)[:3] == ("Phase5 New v2", "sheet", 1))

    lib = json.loads(pg.evaluate("fetch('/api/screamsheets?owner=test-gm').then(r=>r.text())"))
    ids = [a["id"] for a in lib]
    check("library has mixed rows newest first", ids.index(new_id) < ids.index(copy_id) < ids.index("legacy001"), str([(a['id'], a['version']) for a in lib]))
    check("library never leaks GM keys", all("ownerKey" not in a and "owner_key" not in a for a in lib))
    br.close()

# Old client: a payload without metadata still saves (and never downgrades a v1 row)
import urllib.request
def req(method, path, body):
    r = urllib.request.Request(B.rstrip("/") + path, data=json.dumps(body).encode(), method=method, headers={"content-type": "application/json"})
    with urllib.request.urlopen(r) as resp: return resp.status, json.loads(resp.read())
base = dict(template="nct-tech", branding={"outlet": "X", "tagline": "Y", "accent": "#f00", "headerBg": "#fff", "headerText": "#000", "logoStyle": "nct"},
            settings={"clock": "1", "categories": ["A"], "activeCategory": "A", "showNav": True, "ticker": "", "columns": 1}, blocks=[])
st, body = req("PUT", f"/api/screamsheets/{new_id}?owner=test-gm", dict(base, title="old client edit"))
check("old client PUT succeeds and does not downgrade v1", st == 200 and row(new_id)[1:3] == ("sheet", 1))
st, body = req("POST", "/api/screamsheets", dict(base, title="old client create", ownerKey="test-gm"))
check("old client POST succeeds (legacy row)", st == 200 and row(body["id"])[1:3] == (None, None))
try:
    req("POST", "/api/screamsheets", dict(base, title="bad", ownerKey="test-gm", artifactType="textThread", schemaVersion=1)); bad = 200
except urllib.error.HTTPError as e: bad = e.code
check("bad artifactType rejected with 400", bad == 400)

print("\nALL PASS" if not fails else f"\n{len(fails)} FAIL: {fails}")
sys.exit(1 if fails else 0)
