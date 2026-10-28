# Phase 4 smoke test: legacy rows must keep working in the UI.
# Needs `npm run dev` running against a data.db that contains a legacy row
# "legacy001" (owner test-gm) and a corrupt row "broken001". See
# docs/phase-4-walkthrough.md for the seeding snippet.
import json, sqlite3
from playwright.sync_api import sync_playwright
B = "http://localhost:5000/"
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page()
    pg.goto(B); pg.evaluate("localStorage.setItem('screamsheet:gmKey','test-gm')")
    pg.reload(); pg.wait_for_timeout(1500)  # reload so Home picks up the GM key
    html = pg.content()
    print("library shows legacy sheet:", "Legacy Sheet" in html, "| hides broken row:", "Broken" not in html)
    pg.goto(B + "#/s/legacy001"); pg.wait_for_timeout(1500)
    print("old share link renders:", "LEGACY HEADLINE" in pg.content())
    pg.goto(B + "#/s/broken001"); pg.wait_for_timeout(1500)
    print("broken share link shows error state (no crash):", "LEGACY HEADLINE" not in pg.content())
    pg.goto(B + "#/build/nct-tech?edit=legacy001"); pg.wait_for_timeout(1500)
    print("edit loads legacy:", pg.input_value('[data-testid=input-title]'), "|", pg.input_value('[data-testid=input-ticker]'))
    pg.fill('[data-testid=input-title]', 'Legacy Sheet edited'); pg.click('[data-testid=button-save]')
    pg.wait_for_selector('[data-testid=input-sharelink]')
    print("overwrite kept id:", pg.input_value('[data-testid=input-sharelink]').endswith('/s/legacy001'))
    br.close()
row = sqlite3.connect("data.db").execute("select title, artifact_type, schema_version from screamsheets where id='legacy001'").fetchone()
print("row after save (still legacy, cols NULL):", row)
