# Seed a fresh local data.db with one legacy row ("legacy001", owner test-gm)
# and one corrupt row ("broken001"). Stop the dev server, delete data.db,
# start it once (creates the table), stop it, then run this.
import sqlite3, json
c = sqlite3.connect("data.db")
b = dict(outlet="NIGHT CITY TODAY", tagline="NEWS", accent="#c0392b", headerBg="#fff", headerText="#111", logoStyle="nct")
s = dict(clock="1:00 AM", categories=["TECH"], activeCategory="TECH", showNav=True, ticker="LEGACY TICKER", columns=1)
bl = [dict(id="h1", type="headline", text="LEGACY HEADLINE", size="lead")]
q = "insert or replace into screamsheets (id,title,template,branding,settings,blocks,created_at,owner_key) values (?,?,?,?,?,?,?,?)"
c.execute(q, ("legacy001", "Legacy Sheet", "nct-tech", json.dumps(b), json.dumps(s), json.dumps(bl), 1700000000000, "test-gm"))
c.execute(q, ("broken001", "Broken", "nct-tech", json.dumps(b), "{not json", json.dumps(bl), 1700000000001, "test-gm"))
c.commit(); print("seeded legacy001 + broken001")
