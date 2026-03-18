#!/usr/bin/env python3
"""Kika i Turso-databasen — tabeller och radantal."""
import json, os, sys
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared import _PROJECT_ROOT
from dotenv import load_dotenv

load_dotenv(_PROJECT_ROOT / ".env")
load_dotenv(_PROJECT_ROOT / ".env.local", override=True)

DB_URL   = os.environ.get("TURSO_DATABASE_URL", "").replace("libsql://", "https://")
DB_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

if not DB_URL or not DB_TOKEN:
    print("TURSO_DATABASE_URL eller TURSO_AUTH_TOKEN saknas")
    sys.exit(1)

print(f"DB: {DB_URL}\n")

def query(sql: str):
    body = json.dumps({"requests": [
        {"type": "execute", "stmt": {"sql": sql}},
        {"type": "close"},
    ]}).encode()
    req = Request(
        f"{DB_URL}/v2/pipeline",
        data=body,
        headers={"Authorization": f"Bearer {DB_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=12) as r:
        return json.loads(r.read())["results"][0]["response"]["result"]

def val(cell):
    return cell["value"] if isinstance(cell, dict) else cell

# Tabeller
res = query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [val(row[0]) for row in res["rows"]]
print(f"Tabeller ({len(tables)}):")
for t in tables:
    cnt = query(f"SELECT COUNT(*) FROM {t}")
    n = val(cnt["rows"][0][0])
    print(f"  {t:30s}  {n:>6} rader")

# Visa kolumner för users och moves
for t in ("users", "moves"):
    if t not in tables:
        continue
    cols = query(f"PRAGMA table_info({t})")
    print(f"\n{t} — kolumner:")
    for row in cols["rows"]:
        name = row["values"][1]["value"]
        typ  = row["values"][2]["value"]
        print(f"  {name:30s} {typ}")

# Visa senaste 3 users (utan PNR)
if "users" in tables:
    sample = query("SELECT id, name, first_name, last_name, email, created_at FROM users ORDER BY id DESC LIMIT 3")
    if sample["rows"]:
        print("\nSenaste users (utan PNR):")
        cols = [c["name"] for c in sample["columns"]]
        for row in sample["rows"]:
            vals = {cols[i]: row["values"][i]["value"] for i in range(len(cols))}
            print(f"  {vals}")
