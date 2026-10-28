# Smoke test for the builder. Start `npm run dev` (port 5000) first, then:
#   pip install playwright && python -m playwright install chromium
#   python script/e2e-builder.py
# Uses a throwaway GM key "test-gm" against your LOCAL SQLite db.
import json, re
from playwright.sync_api import sync_playwright
B="http://localhost:5000/"
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(accept_downloads=True)
    pg.on("console", lambda m: m.type=="error" and errs.append(m.text))
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B); pg.evaluate("localStorage.setItem('screamsheet:gmKey','test-gm')")
    pg.goto(B+"#/"); pg.wait_for_selector('[data-testid=card-template-nct-tech]')
    print("home templates:", pg.locator('[data-testid^=card-template-]').count())
    pg.click('[data-testid=card-template-nct-tech]'); pg.wait_for_selector('[data-testid=input-title]')
    print("new title:", pg.input_value('[data-testid=input-title]'))
    pg.fill('[data-testid=input-title]','E2E Sheet')
    n0=pg.locator('[data-testid^=block-]').count()
    pg.click('[data-testid=button-add-pullquote]')
    print("blocks", n0, "->", pg.locator('[data-testid^=block-]').count())
    first=pg.locator('[data-testid^=block-]').first.get_attribute('data-testid')
    pg.locator('[data-testid^=button-down-]').first.click()
    print("move ok:", pg.locator('[data-testid^=block-]').nth(1).get_attribute('data-testid')==first)
    pg.fill('[data-testid=input-ticker]','BREAKING E2E')
    pg.click('[data-testid=button-save]'); pg.wait_for_selector('[data-testid=input-sharelink]')
    url=pg.input_value('[data-testid=input-sharelink]'); sid=url.split('/s/')[1]; print("saved id", sid)
    print("banner after create:", pg.locator('[data-testid=banner-editing]').count())
    pg.fill('[data-testid=input-title]','E2E Sheet v2'); pg.click('[data-testid=button-save]')
    pg.wait_for_timeout(800)
    rows=json.loads(pg.evaluate("fetch('/api/screamsheets?owner=test-gm').then(r=>r.text())"))
    print("library after update:", [(r['id'],r['title']) for r in rows])
    with pg.expect_download() as d: pg.click('[data-testid=button-export-png]')
    print("png:", d.value.suggested_filename)
    # edit flow from library
    pg.goto(B+"#/"); pg.wait_for_timeout(800)
    pg.goto(B+f"#/build/nct-tech?edit={sid}"); pg.wait_for_timeout(1200)
    print("edit loaded title:", pg.input_value('[data-testid=input-title]'), "banner:", pg.locator('[data-testid=banner-editing]').count(), "ticker:", pg.input_value('[data-testid=input-ticker]'))
    pg.goto(B+f"#/build/nct-tech?load={sid}"); pg.wait_for_timeout(1200)
    print("copy title:", pg.input_value('[data-testid=input-title]'), "banner:", pg.locator('[data-testid=banner-editing]').count())
    pg.click('[data-testid=button-save]'); pg.wait_for_selector('[data-testid=input-sharelink]')
    rows=json.loads(pg.evaluate("fetch('/api/screamsheets?owner=test-gm').then(r=>r.text())"))
    print("library after copy:", len(rows))
    pg.goto(B+f"#/s/{sid}"); pg.wait_for_timeout(1500)
    print("share view has ticker:", "BREAKING E2E" in pg.content())
    pg.goto(B+"#/build/custom"); pg.wait_for_selector('[data-testid=input-categories]')
    pg.fill('[data-testid=input-categories]','a, b, c'); pg.click('[data-testid=input-title]')
    print("cats committed:", pg.input_value('[data-testid=input-categories]'), "title:", pg.input_value('[data-testid=input-title]'))
    pg.goto(B+"#/build/nct-tech?edit=doesnotexist"); pg.wait_for_timeout(1200)
    print("bad id toast:", "Could not load sheet" in pg.content())
    pg.goto(B+"#/build/nct-tech"); pg.set_viewport_size({"width":1280,"height":900}); pg.wait_for_timeout(500)
    pg.screenshot(path="/tmp/builder.png")
    br.close()
print("errors:", [e for e in errs if 'doesnotexist' not in e and '404' not in e][:5])
