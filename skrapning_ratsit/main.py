"""
python main.py                          Interaktiv loop
python main.py 19860528-0299            Direkt-uppslag
python main.py Jakob Eberg Stockholm    Fritextsökning
python main.py --json 19860528-0299     JSON till stdout
"""

import subprocess, sys, json, re, os, time, threading

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SEARCH_JS = os.path.join(SCRIPT_DIR, "search.js")

# ── Färger ───────────────────────────────────────────────────────────
R = "\033[0m"; B = "\033[1m"; D = "\033[2m"; G = "\033[90m"
CY = "\033[36m"; GR = "\033[32m"; YE = "\033[33m"; RE = "\033[31m"; MG = "\033[35m"


# ── Smart parsning av fri input ──────────────────────────────────────

PNR_FULL = re.compile(r"\b(\d{8})-?(\d{4})\b")
PNR_DATE = re.compile(r"\b((?:19|20)\d{6})\b")

def parse_input(raw: str) -> dict:
    """Tolka fri text till strukturerat sökunderlag."""
    raw = raw.strip()
    if not raw:
        return {}

    inp = {}

    # Fullständigt personnummer (12 siffror)
    m = PNR_FULL.search(raw)
    if m:
        inp["pnr"] = f"{m.group(1)}-{m.group(2)}"
        inp["pnrDate"] = m.group(1)
        raw = raw[:m.start()] + raw[m.end():]

    # Partiellt personnummer (8 siffror som ser ut som datum)
    if "pnr" not in inp:
        m = PNR_DATE.search(raw)
        if m:
            inp["pnrDate"] = m.group(1)
            raw = raw[:m.start()] + raw[m.end():]

    # Resten: namn och/eller ort
    words = raw.split()
    if words:
        inp["extra"] = " ".join(words)

    return inp


def build_search_payload(inp: dict) -> dict:
    """Konvertera parsed input till search.js payload."""
    if inp.get("pnr"):
        return {"pnr": inp["pnr"]}

    payload = {}
    if inp.get("pnrDate"):
        payload["pnrDate"] = inp["pnrDate"]
    if inp.get("extra"):
        payload["fornamn"] = inp["extra"]
    return payload


def describe(inp: dict) -> str:
    if inp.get("pnr"):
        return f"PNR {inp['pnr']} → Biluppgifter → Ratsit → Merinfo"
    parts = []
    if inp.get("pnrDate"):
        parts.append(f"Datum {inp['pnrDate']}")
    if inp.get("extra"):
        parts.append(f'"{inp["extra"]}"')
    return " + ".join(parts) + " → Ratsit"


# ── Kör Node.js ──────────────────────────────────────────────────────

def run_search(payload: dict) -> dict | None:
    proc = subprocess.Popen(
        ["node", SEARCH_JS, json.dumps(payload, ensure_ascii=False)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", cwd=SCRIPT_DIR,
    )

    def stream():
        for line in proc.stderr:
            line = line.rstrip()
            if line:
                print(f"  {G}{line}{R}", flush=True)

    t = threading.Thread(target=stream, daemon=True)
    t.start()

    stdout = proc.stdout.read()
    proc.wait()
    t.join(timeout=5)

    if proc.returncode != 0:
        return None

    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return None


# ── Utskrift ─────────────────────────────────────────────────────────

def gender_sv(g): return "Man" if g == "male" else ("Kvinna" if g == "female" else "")
def yn(v): return "Ja" if v else "Nej"

def print_table(hits: list, total: int, skipped: list):
    """Kompakt tabellvy för flera träffar."""
    has_pnr = any(h.get("personnummer") for h in hits)
    print(f"\n  {GR}{B}{total} träffar totalt, visar {len(hits)}{R}")

    if "personnummer_lookup" in skipped:
        print(f"  {YE}! PNR hoppad — smalna av för att se personnummer{R}")

    pnr_w = 16 if has_pnr else 0
    print()
    hdr = f"  {'#':>3}  {'Namn':<32} {'Ålder':>5}  {'Kön':<7} {'Stad':<16}"
    if has_pnr:
        hdr += f" {'Personnummer':<16}"
    print(f"{B}{hdr}{R}")
    print(f"  {'─'*90}")

    for i, h in enumerate(hits, 1):
        name = h.get("name", "?")[:31]
        age = str(h.get("age", "")) + "å" if h.get("age") else ""
        g = gender_sv(h.get("gender", ""))[:3]
        city = h.get("city", "")[:15]
        pnr = h.get("personnummer", "") if has_pnr else ""
        married = "G" if h.get("married") else ""
        bolag = "B" if h.get("hasCompany") else ""
        flags = f" {G}{married}{bolag}{R}" if married or bolag else ""

        row = f"  {i:>3}  {name:<32} {age:>5}  {g:<7} {city:<16}"
        if has_pnr:
            row += f" {YE}{pnr}{R}"
        row += flags
        print(row)


def print_detail(hit: dict):
    """Full detaljvy för enstaka träff."""
    name = hit.get("name", "?")
    pnr = hit.get("personnummer", "")

    print(f"\n  {CY}{B}{'═'*56}{R}")
    print(f"  {CY}{B}  {name}{R}")
    if pnr:
        print(f"  {CY}{B}  {pnr}{R}")
    print(f"  {CY}{B}{'═'*56}{R}")

    def row(label, val):
        if val is not None and val != "":
            print(f"  {B}{label:<20}{R}{val}")

    row("Tilltalsnamn:", hit.get("givenName"))
    row("Ålder:", f"{hit['age']} år" if hit.get("age") else None)
    row("Kön:", gender_sv(hit.get("gender")))
    row("Gift:", yn(hit.get("married")) if hit.get("married") is not None else None)
    row("Adress:", hit.get("address"))
    row("Bolag:", yn(hit.get("hasCompany")) if hit.get("hasCompany") is not None else None)

    coords = hit.get("coordinates")
    if coords and coords.get("lat"):
        row("Koordinater:", f"{coords['lat']}, {coords['lng']}")

    for m in hit.get("medboende", []):
        print(f"  {'Medboende:':<20}{m.get('name')} ({m.get('age')} år)" if hit.get("medboende", []).index(m) == 0
              else f"  {'':<20}{m.get('name')} ({m.get('age')} år)")

    for i, f in enumerate(hit.get("fordonAdress", [])):
        label = "Fordon (adress):" if i == 0 else ""
        print(f"  {label:<20}{f.get('regno')}: {f.get('model')} ({f.get('year')}) — {f.get('owner')}")

    if hit.get("snittLonGata"):
        row("Snittlön (gata):", f"{hit['snittLonGata']:,} kr/år".replace(",", " "))

    if hit.get("anmarkningProcent"):
        row("Anm. (kommun):", f"{hit['anmarkningProcent']}%")

    print(f"  {G}{'─'*56}{R}")


def print_results(data: dict):
    hits = data.get("hits", [])
    total = data.get("totalCount", 0)
    skipped = data.get("skipped", [])

    if not hits:
        print(f"\n  {RE}Inga träffar.{R} {G}Prova med annat sökunderlag.{R}")
        return

    if len(hits) == 1:
        print_detail(hits[0])
    else:
        print_table(hits, total, skipped)


# ── Main ─────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    json_mode = "--json" in args
    if json_mode:
        args.remove("--json")

    # Icke-interaktivt läge: argument på kommandoraden
    if args:
        raw = " ".join(args)
        inp = parse_input(raw)
        payload = build_search_payload(inp)
        if not payload:
            print(f"{RE}Inget sökunderlag.{R}")
            sys.exit(1)
        data = run_search(payload)
        if data:
            if json_mode:
                print(json.dumps(data, indent=2, ensure_ascii=False))
            else:
                print_results(data)
        sys.exit(0)

    # Interaktivt läge
    print(f"\n  {MG}{B}Personsökning{R}  {G}(Biluppgifter + Ratsit + Merinfo){R}")
    print(f"  {G}Skriv personnummer, namn, stad — eller kombinera. 'q' avslutar.{R}\n")

    while True:
        try:
            raw = input(f"  {B}Sök:{R} ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not raw or raw.lower() in ("q", "quit", "exit"):
            break

        inp = parse_input(raw)
        payload = build_search_payload(inp)

        if not payload:
            print(f"  {RE}Kunde inte tolka: \"{raw}\"{R}\n")
            continue

        print(f"  {G}{describe(inp)}{R}")
        t0 = time.time()

        data = run_search(payload)
        elapsed = time.time() - t0
        print(f"  {G}{elapsed:.1f}s{R}")

        if data:
            print_results(data)
        else:
            print(f"  {RE}Sökningen misslyckades.{R}")

        print()

    print(f"\n  {G}Hejdå!{R}\n")


if __name__ == "__main__":
    main()
