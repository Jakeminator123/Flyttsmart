import json, os, sys
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared import _PROJECT_ROOT
from dotenv import load_dotenv

load_dotenv(_PROJECT_ROOT / ".env")
load_dotenv(_PROJECT_ROOT / ".env.local", override=True)

url   = os.environ["TURSO_DATABASE_URL"].replace("libsql://", "https://")
token = os.environ["TURSO_AUTH_TOKEN"]
print("URL:", url)

sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
body = json.dumps({
    "requests": [
        {"type": "execute", "stmt": {"sql": sql}},
        {"type": "close"},
    ]
}).encode()
req = Request(
    f"{url}/v2/pipeline",
    data=body,
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
)
with urlopen(req, timeout=12) as r:
    raw = json.loads(r.read())

print(json.dumps(raw["results"][0], indent=2)[:3000])
